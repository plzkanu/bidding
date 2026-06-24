/**
 * Replit/프로덕션용 Next.js 시작 스크립트.
 * PORT 환경 변수를 읽고 0.0.0.0에 바인딩합니다.
 */
import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["next", "start", "--hostname", "0.0.0.0", "--port", port];

const child = spawn(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
