/**
 * HWP 텍스트 추출용 Python 패키지(hwpkit, lxml) 설치.
 * Nix/Replit 등 externally-managed 환경은 프로젝트 로컬 venv(.venv-hwp)에 설치합니다.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requirements = path.join(root, "scripts", "requirements-hwp.txt");
const venvDir = path.join(root, ".venv-hwp");

function getVenvPython() {
  return process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python3");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function findSystemPython() {
  const nixPaths =
    process.platform === "win32"
      ? []
      : [
          "/run/current-system/sw/bin/python3",
          "/home/runner/.nix-profile/bin/python3",
        ];

  const candidates = unique(
    process.platform === "win32"
      ? [
          process.env.HWP_CONVERT_PYTHON,
          process.env.PYTHON,
          ...nixPaths,
          "py",
          "python",
          "python3",
        ]
      : [
          process.env.HWP_CONVERT_PYTHON,
          process.env.PYTHON,
          ...nixPaths,
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

function ensureVenv(basePython) {
  const venvPython = getVenvPython();
  if (existsSync(venvPython)) return venvPython;

  console.log(`[install-hwp-python-deps] venv 생성: ${venvDir}`);
  const create = spawnSync(basePython, ["-m", "venv", venvDir], {
    stdio: "inherit",
    cwd: root,
  });
  if (create.status !== 0) {
    console.error("[install-hwp-python-deps] venv 생성 실패");
    process.exit(create.status ?? 1);
  }
  return venvPython;
}

const existingVenv = getVenvPython();
const python = existsSync(existingVenv)
  ? existingVenv
  : (() => {
      const basePython = findSystemPython();
      if (!basePython) {
        console.warn(
          "[install-hwp-python-deps] Python을 찾지 못했습니다. HWP 요약은 배포 환경에서 python3 + hwpkit이 필요합니다.",
        );
        process.exit(0);
      }
      return ensureVenv(basePython);
    })();

console.log(
  `[install-hwp-python-deps] ${python} -m pip install -r scripts/requirements-hwp.txt`,
);
const install = spawnSync(
  python,
  ["-m", "pip", "install", "-r", requirements],
  { stdio: "inherit", cwd: root },
);

if (install.status !== 0) {
  console.error("[install-hwp-python-deps] pip install 실패");
  process.exit(install.status ?? 1);
}
