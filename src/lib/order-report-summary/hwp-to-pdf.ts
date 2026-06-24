import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const CONVERSION_TIMEOUT_MS = Number(
  process.env.HWP_PDF_TIMEOUT_MS ?? "120000",
);

export class HwpToPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HwpToPdfError";
  }
}

function getFileExtension(fileName: string): string {
  const base = fileName.replace(/[/\\]/g, "").trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return ".hwp";
  return base.slice(dot).toLowerCase();
}

function resolvePythonExecutable(): string {
  const fromEnv =
    process.env.HWP_CONVERT_PYTHON?.trim() ||
    process.env.PYTHON?.trim();
  if (fromEnv) return fromEnv;

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const candidates = [
        path.join(localAppData, "Programs", "Python", "Python314", "python.exe"),
        path.join(localAppData, "Programs", "Python", "Python313", "python.exe"),
        path.join(localAppData, "Programs", "Python", "Python312", "python.exe"),
        path.join(localAppData, "Programs", "Python", "Python311", "python.exe"),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
      }
    }
    return "python";
  }

  return "python3";
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

function resolveConverterScript(): string {
  if (process.env.HWP_TO_PDF_SCRIPT?.trim()) {
    return path.resolve(process.env.HWP_TO_PDF_SCRIPT.trim());
  }
  return path.resolve(process.cwd(), "scripts", "hwp_to_pdf.py");
}

function runPythonConverter(
  python: string,
  scriptPath: string,
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const backend = process.env.HWP_PDF_BACKEND?.trim();
  const args = [scriptPath, inputPath, outputPath];
  if (backend && backend !== "auto") {
    args.push("--backend", backend);
  }

  return new Promise((resolve, reject) => {
    const scriptDir = path.dirname(scriptPath);
    const child = spawn(python, args, {
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

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += decodeProcessOutput(chunk);
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new HwpToPdfError(
          `HWP→PDF 변환 시간 초과(${CONVERSION_TIMEOUT_MS / 1000}초). 한컴/LibreOffice 상태를 확인하세요.`,
        ),
      );
    }, CONVERSION_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new HwpToPdfError(
          `Python 실행 실패 (${python}): ${err.message}. HWP_CONVERT_PYTHON 환경 변수를 확인하세요.`,
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderr.trim() || `종료 코드 ${code}`;
      reject(new HwpToPdfError(`HWP→PDF 변환 실패: ${detail}`));
    });
  });
}

/** HWP/HWPX 버퍼를 PDF로 변환 (Windows: 한컴 win32com, Linux: LibreOffice) */
export async function convertHwpBufferToPdf(
  buffer: Buffer,
  originalFileName: string,
): Promise<{ pdf: Buffer; pdfFileName: string }> {
  const ext = getFileExtension(originalFileName);
  const safeBase =
    path
      .basename(originalFileName, ext)
      .replace(/[^\w\u3131-\uD79D.-]+/g, "_")
      .slice(0, 80) || "document";

  const baseTemp =
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "bidding-hwp-pdf")
      : tmpdir();
  await mkdir(baseTemp, { recursive: true });
  const tempDir = await mkdtemp(path.join(baseTemp, "conv-"));
  const inputPath = path.join(tempDir, `${safeBase}${ext}`);
  const outputPath = path.join(tempDir, `${safeBase}.pdf`);

  try {
    if (buffer.byteLength < 512) {
      throw new HwpToPdfError("HWP 파일 데이터가 비어 있거나 손상되었습니다.");
    }

    await writeFile(inputPath, buffer);

    const python = resolvePythonExecutable();
    const scriptPath = resolveConverterScript();

    await runPythonConverter(python, scriptPath, inputPath, outputPath);

    const pdf = await readFile(outputPath);
    if (pdf.byteLength === 0) {
      throw new HwpToPdfError("변환된 PDF가 비어 있습니다.");
    }

    return {
      pdf,
      pdfFileName: `${safeBase}.pdf`,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function getHwpConversionSetupHint(): string {
  if (process.platform === "win32") {
    return (
      "Windows: pip install pywin32, 한컴 오피스 설치. " +
      "파일 접근 팝업 제거: developer.hancom.com/hwpautomation 에서 보안모듈 ZIP → " +
      "scripts/hwp-security/ 에 DLL 복사 후 " +
      "powershell scripts/install_hwp_security.ps1 실행."
    );
  }
  return (
    "서버: LibreOffice 설치(soffice) 및 LIBREOFFICE_PATH 설정. " +
    "HWP/HWPX 지원은 배포판에 따라 제한될 수 있습니다."
  );
}
