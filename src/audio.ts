import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { edgeSpeech, requireEdge } from "./edgeVoice";
import type { Story } from "./story";

const sampleRate = 24000;
export type SubtitleCue = { shot: number; text: string; start: number; end: number };

export function speechChunks(text: string): string[] {
  return (text.match(/[^，。！？；：、,.!?;:]+[，。！？；：、,.!?;:]*|[，。！？；：、,.!?;:]+/gu) || [text]).flatMap(part => {
    const chars = [...part]; const chunks: string[] = [];
    for (let i = 0; i < chars.length; i += 24) chunks.push(chars.slice(i, i + 24).join(""));
    return chunks;
  });
}

type Voice = { name: string; language: string };

async function execute(args: string[], cwd?: string) {
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe", timeout: 120000, killSignal: "SIGKILL" });
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).arrayBuffer(), new Response(child.stderr).text(), child.exited,
  ]);
  if (code !== 0) throw new Error(`音频处理失败 (${args[0]}): ${error.slice(-1800)}`);
  return Buffer.from(output);
}

async function windowsVoice(request: object) {
  const temp = await mkdtemp(join(tmpdir(), "yingyaVoice-"));
  try {
    const file = join(temp, "request.json");
    await writeFile(file, JSON.stringify(request));
    return await execute(["powershell.exe", "-NoProfile", "-NonInteractive", "-File",
      resolve(import.meta.dir, "../scripts/systemVoice.ps1"), "-RequestPath", file]);
  } finally { await rm(temp, { recursive: true, force: true }); }
}

export async function voiceStatus() {
  let voices: Voice[] = [];
  try {
    if (process.platform === "darwin") {
      const text = (await execute(["/usr/bin/say", "-v", "?"])).toString();
      voices = text.split("\n").flatMap(line => {
        const match = line.match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/);
        return match ? [{ name: match[1].trim(), language: match[2].replace("_", "-") }] : [];
      });
    } else if (process.platform === "win32") {
      voices = JSON.parse((await windowsVoice({ action: "voices" })).toString().replace(/^\uFEFF/, ""));
    }
    const chinese = voices.filter(voice => voice.language.startsWith("zh"));
    const defaultVoice = chinese.find(voice => voice.name === "Tingting") || chinese.find(voice => voice.language === "zh-CN") || chinese[0];
    return { available: !!defaultVoice, provider: process.platform === "darwin" ? "macOS system voice" : process.platform === "win32" ? "Windows System.Speech" : "unsupported",
      voices: chinese, defaultVoice: defaultVoice?.name, reason: defaultVoice ? undefined : "没有可用的中文系统声音。请安装系统中文语音，或导入已有旁白 audio；不会自动改用收费服务。" };
  } catch (error) {
    return { available: false, provider: "system", voices: [] as Voice[], defaultVoice: undefined, reason: String(error) };
  }
}

export async function requireVoice(name?: string) {
  const status = await voiceStatus();
  const voice = name || status.defaultVoice;
  if (!voice || !status.voices.some(item => item.name === voice)) throw new Error(status.reason || `未找到已安装的中文声音：${voice}`);
  return voice;
}

// Deterministic synthesized accompaniment, no downloaded recordings or generation API.
function musicPcm(duration: number, preset: "gentle" | "bright" | "calm") {
  const samples = Math.round(duration * sampleRate);
  const data = Buffer.alloc(samples * 2);
  const beat = preset === "bright" ? 0.42 : preset === "calm" ? 0.9 : 0.65;
  const roots = [48, 45, 53, 55];
  const melody = [0, 4, 7, 12, 7, 4, 2, 7];
  const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate, step = Math.floor(t / beat), phase = (t % beat) / beat;
    const root = roots[Math.floor(step / 8) % roots.length];
    const f = frequency(root + 12 + melody[step % melody.length]);
    const envelope = Math.min(1, phase / 0.04) * Math.exp(-phase * 3.8);
    const bell = Math.sin(2 * Math.PI * f * t) + 0.22 * Math.sin(4 * Math.PI * f * t);
    // Fade each chord at boundaries to prevent waveform clicks.
    const chordPhase = (t % (beat * 8)) / (beat * 8);
    const chordEnvelope = Math.min(1, chordPhase / 0.12, (1 - chordPhase) / 0.18);
    const chord = [0, 4, 7].reduce((sum, interval) => sum + Math.sin(2 * Math.PI * frequency(root + interval) * t), 0) / 3;
    const value = 0.24 * envelope * bell + 0.10 * chord * chordEnvelope;
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), i * 2);
  }
  return data;
}

export async function prepareAudio(story: Story, job: string, ffmpeg: string, localPath: (path: string) => Promise<string>) {
  const cues: SubtitleCue[] = [];
  let narration: string | undefined;
  let selectedVoice: string | undefined;
  const speechTimings: { shot: number; originalSeconds: number; speed: number; startsAt: number }[] = [];
  if (story.voiceover) {
    if (story.voiceover.provider === "edge" && !story.voiceover.allowNetwork) throw new Error("联网配音需要用户明确同意发送旁白文字");
    selectedVoice = story.voiceover.provider === "edge" ? await requireEdge(story.voiceover.voice) : await requireVoice(story.voiceover.voice);
    const clips: Buffer[] = [];
    let elapsed = 0;
    for (const [i, shot] of story.shots.entries()) {
      const parts: { text: string; pcm: Buffer }[] = [];
      let networkCues: { text: string; start: number; end: number }[] | undefined;
      if (story.voiceover.provider === "edge") {
        const input = join(job, `speech${i}-edge.mp3`);
        const text = shot.narration || shot.caption;
        networkCues = await edgeSpeech(text, selectedVoice, story.voiceover.networkRate, input);
        const pcm = await execute([ffmpeg, "-v", "error", "-i", input, "-ar", String(sampleRate), "-ac", "1", "-f", "s16le", "pipe:1"]);
        if (networkCues.some(cue => cue.end > pcm.length / (sampleRate * 2) + 0.1)) throw new Error("字幕时间超出配音长度");
        parts.push({ text, pcm });
      } else {
      for (const [partIndex, text] of speechChunks(shot.narration || shot.caption).entries()) {
        const input = join(job, `speech${i}-${partIndex}.${process.platform === "darwin" ? "aiff" : "wav"}`);
        if (process.platform === "darwin") {
          const textPath = join(job, `speech${i}-${partIndex}.txt`);
          await writeFile(textPath, text);
          await execute(["/usr/bin/say", "-v", selectedVoice, "-r", String(story.voiceover.rate), "-f", textPath, "-o", input]);
        } else {
          await windowsVoice({ action: "speak", voice: selectedVoice, rate: story.voiceover.rate, text, output: input });
        }
        const decoded = await execute([ffmpeg, "-v", "error", "-i", input, "-ar", String(sampleRate), "-ac", "1", "-f", "s16le", "pipe:1"]);
        // Trim only near-silence at the outer edges, keeping 40 ms of breathing room.
        let first = 0, last = decoded.length / 2;
        while (first < last && Math.abs(decoded.readInt16LE(first * 2)) < 100) first++;
        while (last > first && Math.abs(decoded.readInt16LE((last - 1) * 2)) < 100) last--;
        if (last <= first) throw new Error(`第 ${i + 1} 镜配音为空`);
        const pcm = decoded.subarray(Math.max(0, first - 960) * 2, Math.min(decoded.length, (last + 960) * 2));
        parts.push({ text, pcm });
      }
      }
      const pauseSamples = Math.round(sampleRate * 0.18);
      const pcm = Buffer.concat(parts.flatMap((part, n) => n < parts.length - 1 ? [part.pcm, Buffer.alloc(pauseSamples * 2)] : [part.pcm]));
      const seconds = pcm.length / (sampleRate * 2);
      if (!seconds) throw new Error(`第 ${i + 1} 镜系统配音为空`);
      const speed = Math.max(1, seconds / (shot.duration - Math.min(0.3, shot.duration * 0.1)));
      if (speed > 1.10) throw new Error(`第 ${i + 1} 镜配音需要 ${seconds.toFixed(1)} 秒，镜头只有 ${shot.duration} 秒。请缩短 narration 或增加镜头时长；不会截断台词。`);
      const raw = join(job, `speech${i}.pcm`);
      await writeFile(raw, pcm);
      const fitted = await execute([ffmpeg, "-v", "error", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", raw,
        "-af", `atempo=${speed.toFixed(6)},apad,atrim=duration=${shot.duration}`, "-f", "s16le", "pipe:1"]);
      // Exact sample alignment avoids cumulative drift across many shots.
      const exact = Buffer.alloc(Math.round((elapsed + shot.duration) * sampleRate) * 2 - Math.round(elapsed * sampleRate) * 2);
      fitted.copy(exact, 0, 0, exact.length); clips.push(exact);
      if (networkCues) {
        cues.push(...networkCues.map(cue => ({ shot: i + 1, text: cue.text, start: elapsed + cue.start / speed, end: elapsed + cue.end / speed })));
      } else {
      let offset = 0;
      for (const [n, part] of parts.entries()) {
        const length = part.pcm.length / (sampleRate * 2);
        cues.push({ shot: i + 1, text: part.text, start: elapsed + offset / speed, end: Math.min(elapsed + shot.duration, elapsed + (offset + length) / speed) });
        offset += length + (n < parts.length - 1 ? 0.18 : 0);
      }
      }
      speechTimings.push({ shot: i + 1, originalSeconds: seconds, speed, startsAt: elapsed });
      elapsed += shot.duration;
    }
    await writeFile(join(job, "narration.pcm"), Buffer.concat(clips));
    narration = join(job, "narration.wav");
    await execute([ffmpeg, "-v", "error", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", join(job, "narration.pcm"), "-y", narration]);
  } else if (story.audio) narration = await localPath(story.audio);

  let music: string | undefined;
  if (story.music) {
    if ("asset" in story.music) music = await localPath(story.music.asset);
    else {
      const raw = join(job, "music.pcm");
      await writeFile(raw, musicPcm(story.duration, story.music.preset));
      music = join(job, "music.wav");
      await execute([ffmpeg, "-v", "error", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", raw, "-y", music]);
    }
  }
  if (!narration && !music) return { cues, file: undefined, details: { narration: "none", music: "none" } };
  const sampleCount = Math.round(story.duration * sampleRate);
  async function decode(path: string, loop: boolean) {
    const args = [ffmpeg, "-nostdin", "-v", "error"];
    if (loop) args.push("-stream_loop", "-1");
    args.push("-i", path, "-t", String(story.duration), "-ar", String(sampleRate), "-ac", "1", "-f", "s16le", "pipe:1");
    const data = await execute(args);
    if (!data.length) throw new Error("音轨没有可解码的声音");
    const exact = Buffer.alloc(sampleCount * 2);
    data.copy(exact, 0, 0, exact.length);
    return exact;
  }
  const voicePcm = narration ? await decode(narration, false) : undefined;
  const backgroundPcm = music ? await decode(music, true) : undefined;
  const mixed = Buffer.alloc(sampleCount * 2);
  const fade = Math.min(1.5, story.duration / 4);
  let envelope = 0, duckGain = 1, peak = 0;
  const envelopeDecay = Math.exp(-1 / (sampleRate * 0.06));
  let duckedSamples = 0;
  for (let i = 0; i < sampleCount; i++) {
    const voice = (voicePcm?.readInt16LE(i * 2) ?? 0) / 32768 * (story.voiceover?.volume ?? 1);
    envelope = Math.max(Math.abs(voice), envelope * envelopeDecay);
    const targetGain = voicePcm && envelope > 0.02 ? 0.28 : 1;
    const smoothing = Math.exp(-1 / (sampleRate * (targetGain < duckGain ? 0.02 : 0.35)));
    duckGain = targetGain + (duckGain - targetGain) * smoothing;
    if (duckGain < 0.9) duckedSamples++;
    const time = i / sampleRate;
    const fadeGain = Math.max(0, Math.min(1, time / fade, (story.duration - time) / fade));
    const background = (backgroundPcm?.readInt16LE(i * 2) ?? 0) / 32768 * (story.music?.volume ?? 0) * duckGain * fadeGain;
    const value = voice + background;
    // Smoothly limit high peaks without integer wraparound or hard digital clipping.
    const magnitude = Math.abs(value);
    const limited = Math.sign(value) * (magnitude <= 0.85 ? magnitude : 0.85 + 0.10 * Math.tanh((magnitude - 0.85) / 0.10));
    peak = Math.max(peak, Math.abs(limited));
    mixed.writeInt16LE(Math.round(limited * 32767), i * 2);
  }
  await writeFile(join(job, "mixed.pcm"), mixed);
  const file = join(job, "mixed.wav");
  await execute([ffmpeg, "-nostdin", "-v", "error", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", join(job, "mixed.pcm"), "-y", file]);
  const details = { narration: story.voiceover ? story.voiceover.provider : story.audio ? "imported" : "none", voice: selectedVoice,
    music: story.music ? "preset" in story.music ? story.music.preset : "imported" : "none", ducking: !!(narration && music), duckedSeconds: music ? duckedSamples / sampleRate : 0, peak, speechTimings, subtitleCues: cues };
  await writeFile(join(job, "audioReport.json"), JSON.stringify(details, null, 2));
  return { cues, file, details };
}
