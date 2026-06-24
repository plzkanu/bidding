#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HWP/HWPX → PDF 변환 (발주요약용)

- Windows + 한컴 오피스: win32com (HWPFrame.HwpObject)
- Linux/서버: LibreOffice headless
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import time

from hwp_security import register_hwp_security_modules, security_setup_hint


def configure_stdio_utf8() -> None:
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8")
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass


def create_hwp_app(win32):
    try:
        return win32.gencache.EnsureDispatch("HWPFrame.HwpObject")
    except Exception:
        return win32.Dispatch("HWPFrame.HwpObject")


def setup_hwp(hwp) -> None:
    register_hwp_security_modules(hwp)


def detect_hwp_format(input_abs: str) -> str:
    try:
        with open(input_abs, "rb") as handle:
            head = handle.read(4)
        if head[:2] == b"PK":
            return "HWPX"
    except OSError:
        pass
    return "HWP"


def verify_document_opened(hwp) -> None:
    try:
        count = int(hwp.XHwpDocuments.Count)
        if count < 1:
            raise RuntimeError("한글 문서가 열리지 않았습니다.")
    except AttributeError:
        pass


def open_hwp_document(hwp, input_abs: str) -> None:
    doc_format = detect_hwp_format(input_abs)
    last_error: Exception | None = None

    open_options = (
        "forceopen:true;versionwarning:false;noattr:true;lock:false",
        "forceopen:true",
        "",
    )
    open_attempts = [
        lambda: hwp.Open(input_abs),
        lambda: hwp.Open(input_abs, "", ""),
    ]
    for opt in open_options:
        open_attempts.append(lambda o=opt: hwp.Open(input_abs, doc_format, o))
        open_attempts.append(lambda o=opt: hwp.Open(input_abs, "HWP", o))

    for opener in open_attempts:
        try:
            result = opener()
            if result is False:
                continue
            verify_document_opened(hwp)
            return
        except Exception as exc:
            last_error = exc

    detail = str(last_error) if last_error else "Open 반환값 False"
    raise RuntimeError(f"한글 파일 열기 실패: {detail}")


def wait_for_pdf(output_abs: str, input_abs: str, timeout_sec: float = 30.0) -> str:
    base_pdf = os.path.splitext(input_abs)[0] + ".pdf"
    out_dir = os.path.dirname(output_abs) or "."
    base_name = os.path.splitext(os.path.basename(input_abs))[0]
    same_dir_pdf = os.path.join(out_dir, base_name + ".pdf")

    candidates = [output_abs, base_pdf, same_dir_pdf]
    deadline = time.time() + timeout_sec

    while time.time() < deadline:
        for path in candidates:
            if os.path.isfile(path) and os.path.getsize(path) > 0:
                if os.path.abspath(path) != os.path.abspath(output_abs):
                    shutil.move(path, output_abs)
                return output_abs
        time.sleep(0.25)

    raise RuntimeError("한컴 오피스 PDF 저장 결과 파일이 없습니다.")


def try_save_pdf(hwp, output_abs: str) -> bool:
    """여러 한컴 저장 API를 순서대로 시도. 성공 시 True."""

    def save_via_haction_with_getdefault() -> bool:
        hwp.HAction.GetDefault("FileSaveAs_S", hwp.HParameterSet.HFileOpenSave.HSet)
        hwp.HParameterSet.HFileOpenSave.filename = output_abs
        hwp.HParameterSet.HFileOpenSave.Format = "PDF"
        return bool(
            hwp.HAction.Execute("FileSaveAs_S", hwp.HParameterSet.HFileOpenSave.HSet)
        )

    def save_via_haction_direct() -> bool:
        hwp.HParameterSet.HFileOpenSave.filename = output_abs
        hwp.HParameterSet.HFileOpenSave.Format = "PDF"
        return bool(
            hwp.HAction.Execute("FileSaveAs_S", hwp.HParameterSet.HFileOpenSave.HSet)
        )

    def save_via_create_action() -> bool:
        act = hwp.CreateAction("FileSaveAs_S")
        pset = act.CreateSet()
        act.GetDefault(pset)
        pset.SetItem("Filename", output_abs)
        pset.SetItem("Format", "PDF")
        return bool(act.Execute(pset))

    def save_via_saveas() -> bool:
        return bool(hwp.SaveAs(output_abs, "PDF"))

    for attempt in (
        save_via_haction_with_getdefault,
        save_via_haction_direct,
        save_via_create_action,
        save_via_saveas,
    ):
        try:
            if attempt():
                return True
        except Exception:
            continue

    return False


def convert_win32com_once(
    win32,
    input_abs: str,
    output_abs: str,
    *,
    show_window: bool,
) -> None:
    hwp = create_hwp_app(win32)
    try:
        setup_hwp(hwp)
        if show_window:
            try:
                hwp.XHwpWindows.Item(0).Visible = True
            except Exception:
                pass

        open_hwp_document(hwp, input_abs)

        if not try_save_pdf(hwp, output_abs):
            raise RuntimeError("한컴 PDF 저장 명령이 모두 실패했습니다.")

        wait_for_pdf(output_abs, input_abs)
    finally:
        try:
            hwp.Clear(1)
        except Exception:
            pass
        try:
            hwp.Quit()
        except Exception:
            pass


def convert_win32com(input_path: str, output_path: str) -> None:
    try:
        import win32com.client as win32  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "pywin32가 필요합니다. 터미널에서 실행: pip install pywin32"
        ) from exc

    input_abs = os.path.abspath(input_path)
    output_abs = os.path.abspath(output_path)
    out_dir = os.path.dirname(output_abs)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    if os.path.getsize(input_abs) < 512:
        raise RuntimeError("HWP 파일이 너무 작거나 손상되었습니다.")

    if os.path.isfile(output_abs):
        try:
            os.remove(output_abs)
        except OSError:
            pass

    last_error: Exception | None = None
    for show_window in (False, True):
        try:
            convert_win32com_once(
                win32,
                input_abs,
                output_abs,
                show_window=show_window,
            )
            return
        except Exception as exc:
            last_error = exc
            if os.path.isfile(output_abs):
                try:
                    os.remove(output_abs)
                except OSError:
                    pass

    err_msg = str(last_error or "한컴 PDF 변환 실패")
    hint = security_setup_hint()
    if hint and hint not in err_msg:
        err_msg = f"{err_msg} — {hint}"
    raise RuntimeError(err_msg)


def resolve_libreoffice() -> str:
    env_path = os.environ.get("LIBREOFFICE_PATH", "").strip()
    if env_path and os.path.isfile(env_path):
        return env_path

    for candidate in (
        "soffice",
        "libreoffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ):
        found = shutil.which(candidate) if os.sep not in candidate else (
            candidate if os.path.isfile(candidate) else None
        )
        if found:
            return found

    raise RuntimeError(
        "LibreOffice(soffice)를 찾을 수 없습니다. "
        "설치하거나 LIBREOFFICE_PATH 환경 변수를 설정하세요."
    )


def convert_libreoffice(input_path: str, output_path: str) -> None:
    soffice = resolve_libreoffice()
    input_abs = os.path.abspath(input_path)
    output_abs = os.path.abspath(output_path)
    outdir = os.path.dirname(output_abs) or "."
    os.makedirs(outdir, exist_ok=True)

    proc = subprocess.run(
        [
            soffice,
            "--headless",
            "--norestore",
            "--convert-to",
            "pdf",
            "--outdir",
            outdir,
            input_abs,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=int(os.environ.get("HWP_PDF_TIMEOUT_SEC", "120")),
    )

    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(
            f"LibreOffice 변환 실패 (code {proc.returncode}): {detail}"
        )

    wait_for_pdf(output_abs, input_abs, timeout_sec=10.0)


def backends_for(requested: str) -> list[str]:
    if requested == "win32com":
        return ["win32com"]
    if requested == "libreoffice":
        return ["libreoffice"]
    if platform.system() == "Windows":
        return ["win32com", "libreoffice"]
    return ["libreoffice"]


def run_backend(backend: str, input_path: str, output_path: str) -> None:
    if backend == "win32com":
        convert_win32com(input_path, output_path)
    else:
        convert_libreoffice(input_path, output_path)


def main() -> int:
    configure_stdio_utf8()

    parser = argparse.ArgumentParser(description="HWP/HWPX to PDF converter")
    parser.add_argument("input", help="입력 HWP/HWPX 경로")
    parser.add_argument("output", help="출력 PDF 경로")
    parser.add_argument(
        "--backend",
        choices=["auto", "win32com", "libreoffice"],
        default=os.environ.get("HWP_PDF_BACKEND", "auto"),
    )
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"입력 파일 없음: {args.input}", file=sys.stderr)
        return 1

    if os.path.isfile(args.output):
        try:
            os.remove(args.output)
        except OSError:
            pass

    errors: list[str] = []

    for backend in backends_for(args.backend):
        try:
            run_backend(backend, args.input, args.output)
            if os.path.isfile(args.output) and os.path.getsize(args.output) > 0:
                return 0
            errors.append(f"{backend}: PDF 출력이 비어 있습니다.")
        except Exception as exc:
            errors.append(f"{backend}: {exc}")

    print(" / ".join(errors), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
