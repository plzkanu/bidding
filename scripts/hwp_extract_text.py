"""HWP/HWPX 텍스트 추출 — hwpkit 사용 (Node @hwp.js/parser 실패 시 폴백)."""
from __future__ import annotations

import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: hwp_extract_text.py <file>", file=sys.stderr)
        return 2

    path = sys.argv[1]
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""

    try:
        if ext == "hwpx":
            from hwpkit import extract_text_from_hwpx

            text = extract_text_from_hwpx(path)
        else:
            from hwpkit import extract_text_from_hwp

            text = extract_text_from_hwp(path)
    except ImportError as exc:
        message = str(exc).strip()
        if "lxml" in message.lower() or ext == "hwpx":
            print(
                "HWPX 텍스트 추출에는 lxml이 필요합니다: py -m pip install lxml "
                '(또는 py -m pip install "hwpkit[hwpx]")',
                file=sys.stderr,
            )
        else:
            print(
                "hwpkit 패키지가 필요합니다: py -m pip install hwpkit",
                file=sys.stderr,
            )
        if message:
            print(message, file=sys.stderr)
        return 3
    except Exception as exc:
        print(f"HWP 텍스트 추출 실패: {exc}", file=sys.stderr)
        return 1

    if not text or not text.strip():
        print("HWP 파일에서 텍스트를 추출할 수 없습니다.", file=sys.stderr)
        return 1

    sys.stdout.reconfigure(encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
