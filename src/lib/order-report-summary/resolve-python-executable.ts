import { existsSync } from "node:fs";
import path from "node:path";

/** HWP_CONVERT_PYTHON / PYTHON 미설정 시 시도할 Python 실행 파일 후보 (순서대로) */
export function resolvePythonExecutableCandidates(): string[] {
  const fromEnv =
    process.env.HWP_CONVERT_PYTHON?.trim() || process.env.PYTHON?.trim();
  if (fromEnv) return [fromEnv];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const candidates: string[] = [];
    if (localAppData) {
      for (const version of ["Python314", "Python313", "Python312", "Python311"]) {
        candidates.push(
          path.join(localAppData, "Programs", "Python", version, "python.exe"),
        );
      }
    }
    candidates.push("py", "python", "python3");
    return uniqueExisting(candidates);
  }

  return uniqueExisting(["python3", "python"]);
}

function uniqueExisting(candidates: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (path.isAbsolute(candidate)) {
      if (existsSync(candidate)) result.push(candidate);
    } else {
      result.push(candidate);
    }
  }
  return result;
}

/** @deprecated 후보 목록의 첫 항목. spawn 실패 시 호출부에서 후보 전체를 시도하세요. */
export function resolvePythonExecutable(): string {
  const candidates = resolvePythonExecutableCandidates();
  return candidates[0] ?? (process.platform === "win32" ? "py" : "python3");
}
