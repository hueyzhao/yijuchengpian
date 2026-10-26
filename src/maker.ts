import { createFfmpeg } from "@yijuchengpian/ffmpeg";
import { copyFile, mkdir, readFile, realpath, stat, writeAtomic, writeFile } from "@yijuchengpian/file";
import ffmpegPath from "ffmpeg-static";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { validateStory } from "./story";
import { edgeStatus, requireEdge } from "./edgeVoice";
import { prepareAudio, requireVoice, voiceStatus } from "./audio";

export const workspace = resolve(process.env.YIJUCHENGPIAN_WORKSPACE || "workspace");

export async function localPath(value: string) {
  if (isAbsolute(value) || !value || value.includes(":")) throw new Error("只接受工作目录内的相对路径");
  const root = await realpath(workspace);
  const path = await realpath(resolve(root, value));
  const offset = relative(root, path);
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) throw new Error("素材不能位于工作目录之外");
  if (!(await stat(path)).isFile()) throw new Error("素材必须是文件");
  return path;
}

function binary() {
  const path = process.env.YIJUCHENGPIAN_FFMPEG || ffmpegPath;
  if (!path) throw new Error("此平台没有可用 FFmpeg，请设置 YIJUCHENGPIAN_FFMPEG");
  return path;
}

export async function doctor() {
  await mkdir(workspace, { recursive: true });
  const child = Bun.spawn([binary(), "-version"], { stdout: "pipe", stderr: "pipe", timeout: 15000 });
  const output = await new Response(child.stdout).text();
  const code = await child.exited;
  if (code !== 0) throw new Error("FFmpeg 不可运行，请重新执行安装");
  return { product: "一句成片", version: "0.3.1", workspace, ffmpeg: output.split("\n")[0], voiceover: await voiceStatus(), onlineVoiceover: await edgeStatus(), musicPresets: ["gentle", "bright", "calm"], paidApiCalls: 0 };
}

export async function loadStory(path: string) {
  return validateStory(JSON.parse(await readFile(await localPath(path), "utf8")));
}

export async function validateProject(path: string) {
  const { story, warnings } = await loadStory(path);
  for (const shot of story.shots) {
    const asset = await localPath(shot.asset);
    if (!/\.(png|jpe?g|webp|mp4|mov|webm)$/i.test(asset)) throw new Error("素材只支持 PNG/JPG/WebP/MP4/MOV/WebM");
  }
  if (story.audio && !/\.(wav|mp3|m4a)$/i.test(await localPath(story.audio))) throw new Error("配音只支持 WAV/MP3/M4A");
  if (story.music && "asset" in story.music && !/\.(wav|mp3|m4a)$/i.test(await localPath(story.music.asset))) throw new Error("背景音乐只支持 WAV/MP3/M4A");
  if (story.voiceover) {
    if (story.voiceover.provider === "edge") await requireEdge(story.voiceover.voice);
    else await requireVoice(story.voiceover.voice);
  }
  return { valid: true, title: story.title, duration: story.duration, shots: story.shots.length, warnings };
}

function timestamp(seconds: number) {
  return new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23).replace(".", ",");
}

async function run(command: ReturnType<ReturnType<typeof createFfmpeg>>) {
  await new Promise<void>((resolve, reject) => command.on("end", () => resolve()).on("error", reject).run());
}

let rendering = false;
export async function renderProject(path: string) {
  if (rendering) throw new Error("已有视频正在制作，请等待完成后再提交");
  rendering = true;
  let job: string | undefined;
  try {
    await validateProject(path);
    const { story, warnings } = await loadStory(path);
    // 每次使用全新目录，既有视频和用户素材不会被覆盖。
    job = join(workspace, "output", randomUUID());
    await mkdir(job, { recursive: true });
    const statusPath = join(job, "status.json");
    await writeAtomic(statusPath, JSON.stringify({ status: "rendering", phase: "audio", title: story.title }));
    const audio = await prepareAudio(story, job, binary(), localPath);
    const ffmpeg = createFfmpeg(job);
    ffmpeg.setFfmpegPath(binary());
    const fontCandidates = [process.env.YIJUCHENGPIAN_FONT, "/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/STHeiti Medium.ttc", "/System/Library/Fonts/Supplemental/Songti.ttc", "C:/Windows/Fonts/msyh.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"].filter(Boolean) as string[];
    let font: string | undefined;
    for (const candidate of fontCandidates) { try { if ((await stat(candidate)).isFile()) { font = candidate; break; } } catch {} }
    if (!font) throw new Error("未找到中文字体，请设置 YIJUCHENGPIAN_FONT 为本机中文字体路径");
    await copyFile(font, join(job, "font.ttc"));
    const subtitles: string[] = [];
    let elapsed = 0;
    for (const [index, shot] of story.shots.entries()) {
      const source = await localPath(shot.asset);
      const input = `asset${index}${extname(source).toLowerCase()}`;
      await copyFile(source, join(job, input));
      const shotCues = story.voiceover ? audio.cues.filter(cue => cue.shot === index + 1)
        : [{ text: shot.caption, start: elapsed, end: elapsed + shot.duration }];
      const captionFilters: string[] = [];
      for (const [cueIndex, cue] of shotCues.entries()) {
        const chars = [...cue.text];
        const lines: string[] = [];
        for (let n = 0; n < chars.length; n += 24) lines.push(chars.slice(n, n + 24).join(""));
        const caption = lines.join("\n");
        const name = `caption${index}-${cueIndex}.txt`;
        await writeFile(join(job, name), caption, { flag: "wx" });
        captionFilters.push(`drawtext=fontfile=font.ttc:textfile=${name}:expansion=none:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=12:x=(w-text_w)/2:y=h-text_h-42:enable='gte(t,${(cue.start - elapsed).toFixed(6)})*lt(t,${(cue.end - elapsed).toFixed(6)})'`);
        subtitles.push(`${subtitles.length + 1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${caption}\n`);
      }
      const image = /\.(png|jpg|jpeg|webp)$/i.test(input);
      const command = ffmpeg(input, { timeout: 180 });
      if (image) command.inputOptions(["-loop 1"]);
      else command.inputOptions(["-stream_loop -1"]);
      command.noAudio().videoFilters([
        "scale=1280:720:force_original_aspect_ratio=decrease",
        "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x101827",
        "setsar=1",
        ...captionFilters,
      ]).duration(shot.duration).fps(25).videoCodec("libx264").outputOptions(["-pix_fmt yuv420p", "-preset veryfast", "-crf 20", "-threads 2"]).output(`shot${index}.mp4`);
      await run(command);

      elapsed += shot.duration;
      await writeAtomic(statusPath, JSON.stringify({ status: "rendering", completedShots: index + 1, totalShots: story.shots.length }));
    }
    await writeFile(join(job, "concat.txt"), story.shots.map((_, index) => `file 'shot${index}.mp4'`).join("\n"), { flag: "wx" });
    const final = ffmpeg("concat.txt", { timeout: 180 }).inputOptions(["-f concat", "-safe 1"]);
    if (audio.file) {
      final.input("mixed.wav").outputOptions(["-map 0:v:0", "-map 1:a:0"]).audioCodec("aac");
    }
    await run(final.videoCodec("copy").duration(story.duration).outputOptions(["-movflags +faststart"]).output("video.mp4"));
    await writeFile(join(job, "subtitles.srt"), subtitles.join("\n"), { flag: "wx" });
    await writeAtomic(join(job, "story.json"), JSON.stringify(story, null, 2));
    const result = { status: "completed", video: join(job, "video.mp4"), subtitles: join(job, "subtitles.srt"), duration: story.duration, audio: audio.details, warnings, paidApiCalls: 0 };
    await writeAtomic(statusPath, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    if (job) await writeAtomic(join(job, "status.json"), JSON.stringify({ status: "failed", error: String(error) }));
    throw error;
  } finally { rendering = false; }
}
