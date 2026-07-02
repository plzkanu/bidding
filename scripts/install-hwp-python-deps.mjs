/**
 * HWP 텍스트 추출용 Python 패키지(hwpkit, lxml) 설치.
 * Python이 없으면 경고만 출력하고 종료(로컬 Node-only 환경 허용).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requirements = path.join(root, "scripts", "requirements-hwp.txt");

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function findPython() {
  const candidates = unique(
    process.platform === "win32"
      ? [
          process.env.HWP_CONVERT_PYTHON,
          process.env.PYTHON,
          "py",
          "python",
          "python3",
        ]
      : [
          process.env.HWP_CONVERT_PYTHON,
          process.env.PYTHON,
          "python3",
          "python",
        ],
  );

  for (const candidate of candidates) {
    const check = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (check.status === 0) return candidate;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.warn(
    "[install-hwp-python-deps] Python을 찾지 못했습니다. HWP 요약은 배포 환경에서 python3 + hwpkit이 필요합니다.",
  );
  process.exit(0);
}

console.log(`[install-hwp-python-deps] ${python} -m pip install -r scripts/requirements-hwp.txt`);
const install = spawnSync(
  python,
  ["-m", "pip", "install", "-r", requirements],
  { stdio: "inherit", cwd: root },
);

if (install.status !== 0) {
  console.error("[install-hwp-python-deps] pip install 실패");
  process.exit(install.status ?? 1);
}
