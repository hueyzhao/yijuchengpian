import sharp from "sharp";
import { mkdir, writeAtomic } from "@yijuchengpian/file";
import { join } from "node:path";
import { workspace, renderProject } from "../src/maker";

// 原创演示素材：四幅二维插画，不伪称扩散模型生成或连续动画。
const directory = join(workspace, "demo");
await mkdir(directory, { recursive: true });
for (let index = 0; index < 4; index++) {
  const seedX = [350, 600, 790, 930][index];
  const body = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#122237"/><circle cx="1080" cy="110" r="46" fill="#fff2ba"/><path d="M0 470 Q350 380 640 480 T1280 440 V720 H0" fill="#244b49"/><path d="M0 560 Q500 440 1280 570 V720 H0" fill="#356357"/><rect x="950" y="280" width="130" height="240" rx="12" fill="#655337"/><path d="M920 280 L1015 190 L1110 280" fill="#db8850"/><rect x="990" y="390" width="48" height="90" fill="${index === 3 ? '#ffe29a' : '#233c43'}"/><ellipse cx="${seedX}" cy="500" rx="64" ry="22" fill="#b8cc87"/><circle cx="${seedX - 18}" cy="466" r="44" fill="#edb878"/><path d="M${seedX - 30} 466 q30 -35 40 0 q-5 22 -25 8" fill="none" stroke="#9d653b" stroke-width="7"/><path d="M${seedX + 40} 480 l10 -35 m-4 30 l20 -25" stroke="#b8cc87" stroke-width="7"/><circle cx="${seedX + 50}" cy="445" r="6" fill="#162633"/><circle cx="${seedX + 66}" cy="450" r="6" fill="#162633"/><circle cx="${seedX + 110}" cy="380" r="35" fill="#ffe279" opacity="0.15"/><circle cx="${seedX + 110}" cy="380" r="11" fill="#ffe279"/>${index === 1 || index === 2 ? '<path d="M650 530 Q740 470 850 530" fill="none" stroke="#a7c56e" stroke-width="22"/>' : ''}</svg>`;
  await sharp(Buffer.from(body)).png().toFile(join(directory, `scene${index}.png`));
}
const description = "背着金色圆壳的小蜗牛";
const story = { title: "把月光送回家", duration: 20,
  ...(process.argv.includes("--audio") ? { voiceover: {}, music: { preset: "gentle" } } : {}),
  characters: [{ id: "snail", description }], shots: [
  { duration: 5, visual: `${description}在夜晚迷了路，萤火虫飞来陪伴。`, characterIds: ["snail"], caption: "天黑了，小蜗牛找不到回家的路。", asset: "demo/scene0.png" },
  { duration: 5, visual: `${description}跟着萤火虫来到小溪，发现树叶桥。`, characterIds: ["snail"], caption: "一只萤火虫说：跟着我的光走吧。", asset: "demo/scene1.png" },
  { duration: 5, visual: `${description}慢慢走过树叶桥，萤火虫照亮前方。`, characterIds: ["snail"], caption: "它们跨过小溪，终于看见了小屋。", asset: "demo/scene2.png" },
  { duration: 5, visual: `${description}到家后为萤火虫打开温暖的门。`, characterIds: ["snail"], caption: "小蜗牛打开门：今晚，你也住这里吧。", asset: "demo/scene3.png" },
] };
await writeAtomic(join(directory, "story.json"), JSON.stringify(story, null, 2));
console.log(JSON.stringify(await renderProject("demo/story.json"), null, 2));
