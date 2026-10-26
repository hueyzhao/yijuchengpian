import { join, resolve } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

export type Boundary = { text: string; start: number; end: number };
const python = () => process.env.YINGYA_VOICE_PYTHON || resolve(import.meta.dir, "../local/voice-env", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
async function request(payload: object) {
  const temp = await mkdtemp(join(tmpdir(), "yingyaEdge-"));
  try {
    const file = join(temp, "request.json");
    await writeFile(file, JSON.stringify(payload));
    const child = Bun.spawn([python(), resolve(import.meta.dir, "../scripts/edgeVoice.py"), file], { stdout: "pipe", stderr: "pipe", timeout: 100000, killSignal: "SIGKILL" });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(`免费联网配音失败，未切换到其他服务：${err.slice(-900)}`);
    return JSON.parse(out);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
export async function edgeStatus() {
  try { return { ...(await request({ action: "status" })), networkTested: false }; }
  catch { return { installed: false, networkTested: false, reason: "免费联网配音组件未就绪；请由工作台按 references/online-voice.md 安装。" }; }
}
export async function requireEdge(voice?: string) {
  if (voice && !/^zh-(CN|TW|HK)-[A-Za-z]+Neural$/.test(voice)) throw new Error("联网模式请使用中文 Neural 声音名称，例如 zh-CN-XiaoxiaoNeural");
  const status = await edgeStatus();
  if (!status.installed) throw new Error(status.reason);
  return voice || "zh-CN-XiaoxiaoNeural";
}

// Match metadata to the original script; never silently invent approximate word timing.
export function boundaryCues(text: string, words: Boundary[]): Boundary[] {
  if (!words.length) throw new Error("联网配音缺少字幕时间信息");
  const spans: (Boundary & { from: number; to: number })[] = [];
  let cursor = 0;
  for (const word of words) {
    const token = word.text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    const from = text.indexOf(token, cursor);
    if (!token || from < 0 || /[\p{L}\p{N}]/u.test(text.slice(cursor, from)) || !Number.isFinite(word.start) || word.start < 0 || !Number.isFinite(word.end) || word.end <= word.start || (spans.length && word.start < spans.at(-1)!.end - 0.01)) throw new Error("联网配音文字或时间信息与旁白不符，已停止合成");
    spans.push({ ...word, from, to: from + token.length }); cursor = from + token.length;
  }
  if (/[\p{L}\p{N}]/u.test(text.slice(cursor))) throw new Error("联网配音时间信息遗漏了旁白末尾");
  const cues: Boundary[] = [];
  let groupStart = 0, charStart = 0;
  for (let i = 0; i < spans.length; i++) {
    const next = spans[i + 1]?.from ?? text.length;
    const punctuation = text.slice(spans[i].to, next);
    const nextLength = spans[i + 1] ? [...text.slice(charStart, spans[i + 1].to)].length : 0;
    if (i === spans.length - 1 || /[，。！？；：,.!?;:]/u.test(punctuation) || nextLength > 24) {
      cues.push({ text: text.slice(charStart, next), start: spans[groupStart].start, end: spans[i].end });
      groupStart = i + 1; charStart = next;
    }
  }
  return cues;
}
export async function edgeSpeech(text: string, voice: string, rate: number, output: string) {
  const result = await request({ text, voice, rate: `${rate >= 0 ? "+" : ""}${rate}%`, output });
  return boundaryCues(text, result.boundaries);
}
