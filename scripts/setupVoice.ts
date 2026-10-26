// Run by the host only after the user opts into online narration.
import { resolve } from "node:path";
const root = resolve(import.meta.dir, "..");
const python = process.env.YIJUCHENGPIAN_SETUP_PYTHON || Bun.which("python3") || Bun.which("python");
if (!python) throw new Error("需要 Python 3。请由工作台协助安装后重试；基础离线制作仍可使用。");
async function run(args: string[]) {
  const proc = Bun.spawn(args, { cwd: root, stdout: "inherit", stderr: "inherit", timeout: 180000, killSignal: "SIGKILL" });
  if (await proc.exited !== 0) throw new Error("联网配音组件安装失败，未修改基础制作工具");
}
await run([python, "-m", "venv", resolve(root, "local/voice-env")]);
await run([resolve(root, "local/voice-env", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"), "-m", "pip", "install", "-r", resolve(root, "scripts/requirements-voice.txt")]);
console.log("联网配音组件安装完成；只有用户选择联网配音后才发送旁白。");
