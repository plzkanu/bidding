import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolvePythonExecutableCandidates } from "@/lib/order-report-summary/resolve-python-executable";

const EXTRACT_TIMEOUT_MS = Number(process.env.HWP_TEXT_TIMEOUT_MS ?? "60000");

function getFileExtension(fileName: string): string {
  const base = fileName.replace(/[/\\]/g, "").trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return ".hwp";
  return base.slice(dot).toLowerCase();
}

function decodeProcessOutput(chunk: Buffer): string {
  const utf8 = chunk.toString("utf8");
  if (process.platform !== "win32" || !utf8.includes("\uFFFD")) {
    return utf8;
  }
  try {
    return new TextDecoder("euc-kr").decode(chunk);
  } catch {
    return utf8;
  }
}

function resolveExtractScript(): string {
  if (process.env.HWP_TEXT_SCRIPT?.trim()) {
    return path.resolve(process.env.HWP_TEXT_SCRIPT.trim());
  }
  return path.resolve(process.cwd(), "scripts", "hwp_extract_text.py");
}

function runPythonHwpExtract(
  python: string,
  scriptPath: string,
  inputPath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptDir = path.dirname(scriptPath);
    const child = spawn(python, [scriptPath, inputPath], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      cwd: scriptDir,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        PYTHONPATH: [process.env.PYTHONPATH, scriptDir].filter(Boolean).join(
          path.delimiter,
        ),
      },
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += decodeProcessOutput(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += decodeProcessOutput(chunk);
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`HWP 텍스트 추출 시간 초과(${EXTRACT_TIMEOUT_MS / 1000}초)`));
    }, EXTRACT_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      const code = (err as NodeJS.ErrnoException).code;
      const hint =
        code === "ENOENT"
          ? " Replit 배포 시 .replit에 python3 모듈과 hwpkit 설치가 필요합니다."
          : "";
      reject(
        new Error(
          `Python 실행 실패 (${python}): ${err.message}. HWP_CONVERT_PYTHON 환경 변수를 확인하세요.${hint}`,
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        resolve(stdout);
        return;
      }
      const detail = stderr.trim() || `종료 코드 ${code}`;
      reject(new Error(`HWP 텍스트 추출 실패: ${detail}`));
    });
  });
}

/** @hwp.js/parser 실패 시 hwpkit(Python)으로 HWP/HWPX 텍스트 추출 */
export async function extractHwpTextViaPython(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const ext = getFileExtension(fileName);
  const safeBase =
    path
      .basename(fileName, ext)
      .replace(/[^\w\u3131-\uD79D.-]+/g, "_")
      .slice(0, 80) || "document";

  const tempDir = await mkdtemp(path.join(tmpdir(), "bidding-hwp-text-"));
  const inputPath = path.join(tempDir, `${safeBase}${ext}`);

  try {
    await writeFile(inputPath, buffer);
    const scriptPath = resolveExtractScript();
    const candidates = resolvePythonExecutableCandidates();
    let lastError: Error | null = null;

    for (const python of candidates) {
      try {
        return await runPythonHwpExtract(python, scriptPath, inputPath);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const isMissingExecutable =
          error.message.includes("ENOENT") ||
          error.message.includes("spawn") && error.message.includes("ENOENT");
        lastError = error;
        if (isMissingExecutable && python !== candidates.at(-1)) {
          continue;
        }
        throw error;
      }
    }

    throw lastError ?? new Error("Python 실행 파일을 찾을 수 없습니다.");
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
