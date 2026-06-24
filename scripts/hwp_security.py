# -*- coding: utf-8 -*-
"""한컴 오토메이션 보안 승인 모듈 — 레지스트리 등록 및 RegisterModule 연동."""

from __future__ import annotations

import os
import platform
import sys

if platform.system() != "Windows":
    # Windows 전용
    def ensure_hwp_security_modules() -> list[str]:
        return []

    def register_hwp_security_modules(_hwp) -> list[str]:
        return []

    def security_setup_hint() -> str:
        return ""

else:
    import winreg

    REGISTRY_PATHS = (
        r"SOFTWARE\HNC\HwpAutomation\Modules",
        r"SOFTWARE\Hnc\HwpAutomation\Modules",
    )

    DEFAULT_MODULE_NAME = os.environ.get(
        "HWP_SECURITY_MODULE_NAME", "FilePathCheckerModuleExample"
    )

    DLL_FILE_NAMES = (
        "FilePathCheckerModuleExample.dll",
        "FilePathCeckerModuleExample.dll",
    )

    def _script_dir() -> str:
        return os.path.dirname(os.path.abspath(__file__))

    def _dll_search_paths() -> list[str]:
        paths: list[str] = []

        env_dll = os.environ.get("HWP_SECURITY_DLL_PATH", "").strip()
        if env_dll:
            paths.append(env_dll)

        security_dir = os.environ.get("HWP_SECURITY_DIR", "").strip()
        if not security_dir:
            security_dir = os.path.join(_script_dir(), "hwp-security")
        for name in DLL_FILE_NAMES:
            paths.append(os.path.join(security_dir, name))

        for name in DLL_FILE_NAMES:
            paths.append(os.path.join(r"C:\HNC\Automation_Module", name))

        return paths

    def find_security_dll() -> str | None:
        for candidate in _dll_search_paths():
            if candidate and os.path.isfile(candidate):
                return os.path.abspath(candidate)
        return None

    def read_registered_modules() -> list[tuple[str, str]]:
        """레지스트리에 등록된 (모듈이름, DLL경로) 목록."""
        found: list[tuple[str, str]] = []
        seen: set[str] = set()

        for reg_path in REGISTRY_PATHS:
            try:
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path) as key:
                    index = 0
                    while True:
                        try:
                            name, value, _ = winreg.EnumValue(key, index)
                            index += 1
                            if not name or name in seen:
                                continue
                            path = str(value).strip().strip('"')
                            if path and os.path.isfile(path):
                                seen.add(name)
                                found.append((name, path))
                        except OSError:
                            break
            except OSError:
                continue

        return found

    def write_registry_module(module_name: str, dll_path: str) -> None:
        dll_abs = os.path.abspath(dll_path)
        last_error: OSError | None = None

        for reg_path in REGISTRY_PATHS:
            try:
                with winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_path) as key:
                    winreg.SetValueEx(key, module_name, 0, winreg.REG_SZ, dll_abs)
                return
            except OSError as exc:
                last_error = exc

        if last_error:
            raise RuntimeError(f"보안 모듈 레지스트리 등록 실패: {last_error}")

    def ensure_hwp_security_modules() -> list[str]:
        """
        보안 DLL을 찾아 레지스트리에 등록하고,
        RegisterModule에 사용할 모듈 이름 목록을 반환합니다.
        """
        module_names: list[str] = []

        for name, _path in read_registered_modules():
            if name not in module_names:
                module_names.append(name)

        dll_path = find_security_dll()
        if dll_path:
            module_name = DEFAULT_MODULE_NAME
            write_registry_module(module_name, dll_path)
            if module_name not in module_names:
                module_names.insert(0, module_name)

        # 한컴 문서 예시 이름 (레지스트리에 없어도 시도)
        for fallback in (
            DEFAULT_MODULE_NAME,
            "FilePathCheckerModuleExample",
            "AutomationModule",
            "BiddingAutomationModule",
        ):
            if fallback not in module_names:
                module_names.append(fallback)

        return module_names

    def register_hwp_security_modules(hwp) -> list[str]:
        """HwpObject에 보안 모듈 등록 + 메시지 박스 억제."""
        registered: list[str] = []
        module_names = ensure_hwp_security_modules()

        for name in module_names:
            try:
                hwp.RegisterModule("FilePathCheckDLL", name)
                registered.append(name)
            except Exception:
                continue

        # 모든 메시지/보안 확인창 억제
        for mode in (0x00010000, 0x00000010, 0x00100000):
            try:
                hwp.SetMessageBoxMode(mode)
                break
            except Exception:
                continue

        try:
            hwp.XHwpWindows.Item(0).Visible = False
        except Exception:
            pass

        return registered

    def security_setup_hint() -> str:
        if find_security_dll() or read_registered_modules():
            return ""
        return (
            "한컴 보안 승인 팝업 제거: "
            "https://developer.hancom.com/hwpautomation 에서 "
            "'보안모듈(Automation).zip'을 받아 DLL을 "
            f"{os.path.join(_script_dir(), 'hwp-security')} 에 넣고 "
            "python scripts/install_hwp_security.py 를 실행하세요."
        )


def main() -> int:
    if platform.system() != "Windows":
        print("Windows 전용입니다.", file=sys.stderr)
        return 1

    dll = find_security_dll()
    if not dll:
        print(security_setup_hint(), file=sys.stderr)
        print(
            "\nDLL을 다음 위치 중 하나에 저장하세요:",
            file=sys.stderr,
        )
        for path in _dll_search_paths()[:3]:
            print(f"  - {path}", file=sys.stderr)
        return 1

    modules = ensure_hwp_security_modules()
    print(f"보안 모듈 등록 완료: {dll}")
    print(f"RegisterModule 이름: {', '.join(modules[:3])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
