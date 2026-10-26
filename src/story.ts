import { z } from "zod";

export const storySchema = z.object({
  title: z.string().trim().min(1).max(80),
  duration: z.number().int().min(2).max(120),
  characters: z.array(z.object({ id: z.string().min(1).max(32), description: z.string().min(4).max(300) }).strict()).max(8),
  shots: z.array(z.object({
    duration: z.number().min(1).max(30),
    visual: z.string().min(4).max(600),
    characterIds: z.array(z.string()).max(8),
    caption: z.string().trim().min(1).max(48).refine(value => !/[\x00-\x1f\x7f]/.test(value), "字幕不能含控制字符"),
    narration: z.string().trim().min(1).max(160).refine(value => !/[\x00-\x1f\x7f]/.test(value), "旁白不能含控制字符").optional(),
    asset: z.string().min(1).max(500),
  }).strict()).min(1).max(24),
  audio: z.string().min(1).max(500).optional(),
  voiceover: z.object({
    provider: z.enum(["system", "edge"]).default("system"),
    allowNetwork: z.boolean().default(false),
    networkRate: z.number().int().min(-30).max(30).default(-10),
    voice: z.string().trim().min(1).max(100).optional(),
    rate: z.number().int().min(100).max(300).default(170),
    volume: z.number().min(0.1).max(2).default(1),
  }).strict().optional(),
  music: z.union([
    z.object({ preset: z.enum(["gentle", "bright", "calm"]), volume: z.number().min(0.01).max(1).default(0.18) }).strict(),
    z.object({ asset: z.string().min(1).max(500), volume: z.number().min(0.01).max(1).default(0.18) }).strict(),
  ]).optional(),
}).strict();
export type Story = z.infer<typeof storySchema>;

export function validateStory(input: unknown) {
  const story = storySchema.parse(input);
  if (story.audio && story.voiceover) throw new Error("audio 和 voiceover 只能选一个；背景音乐请单独使用 music");
  if (story.voiceover?.provider === "edge" && !story.voiceover.allowNetwork) throw new Error("联网配音需要用户同意发送旁白文字，并设置 allowNetwork: true");
  const ids = new Set(story.characters.map(item => item.id));
  if (ids.size !== story.characters.length) throw new Error("角色 ID 不能重复");
  const total = story.shots.reduce((sum, shot) => sum + shot.duration, 0);
  if (Math.abs(total - story.duration) > 0.001) throw new Error(`分镜合计 ${total} 秒，与目标 ${story.duration} 秒不符`);
  for (const [index, shot] of story.shots.entries()) {
    for (const id of shot.characterIds) {
      if (!ids.has(id)) throw new Error(`第 ${index + 1} 镜引用未知角色 ${id}`);
      const description = story.characters.find(item => item.id === id)!.description;
      if (!shot.visual.includes(description)) throw new Error(`第 ${index + 1} 镜缺少角色 ${id} 的完整描述`);
    }
  }
  const captionCount = story.shots.reduce((sum, shot) => sum + [...shot.caption].length, 0);
  if (captionCount < Math.ceil(story.duration * 1.5)) throw new Error("字幕总字数不足：每秒至少 1.5 字，请补齐剧情");
  const warnings = story.shots.flatMap((shot, index) => [...shot.caption].length / shot.duration > 5 ? [`第 ${index + 1} 镜字幕超过每秒 5 字，阅读可能过快`] : []);
  if (story.audio) warnings.push("导入整条音频未执行语音对齐，字幕按镜头显示，请核对内容与时间。");
  return { story, warnings };
}
