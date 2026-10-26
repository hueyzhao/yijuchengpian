---
name: yijuchengpian
version: "0.3.3"
display_name: "一句成片"
display_name_en: "Yiju Chengpian"
description_zh: "通过对话规划故事与分镜，将本地素材制作成带中文配音、同步字幕和配乐的视频，提供六套创作风格模板。"
description_en: "Plan stories and shots through conversation, then turn local media into videos with Chinese narration, synchronized subtitles and music. Includes six creative style templates."
description: 用一句成片本地工具把故事分镜、本地图片或视频及可选录音制作成带中文字幕的 MP4。用于本地短片、故事插画视频和素材剪辑。
---

# 一句成片

你负责创作和分镜，一句成片负责本地校验与合成。支持系统中文配音与本地合成配乐，不含文生图、文生视频；不要把静态插画合成说成 AI 连续动画。宿主的模型额度仍由宿主计费。

## 首次安装

用户要求安装、试用，或制作工具尚未就绪时，先阅读本技能的 `references/install.md`。WorkBuddy 技能包只包含技能说明与参考文件；制作工具需按指引从官方仓库获取到本地。技能安装成功不等于制作工具已经安装；必须用真实的状态检查和示例成片确认。由你执行当前工作台允许的本地操作，用户只需完成必要的授权，不要要求用户手动输入命令。

## 选择创作风格

创作新故事、科普或产品视频时，先读 [六套风格索引](references/styles.md)，再按用户题材只读相关模板：治愈绘本、悬疑故事、轻松科普、产品介绍、国风故事、搞笑短剧。用户明确风格优先；未指定时推荐一套并继续，不必让用户逐项选择。模板包含剧情节奏、画面提示词、旁白和配乐建议；不是渲染效果。已有完整剧本或只调整声音、字幕时无需套用。

## 制作视频

1. 调用 `yijuchengpian_status` 获取工作目录与工具可用性。如果工具不存在，按安装指引完成连接，或使用已验证的本地命令方式。二者都不可用时报告具体阻塞，不能假装调用成功。
2. 按用户目标写有起因、行动、结果的完整故事。缺少素材时请用户导入图片/视频，或使用宿主本身可用且已获授权的绘图能力。不要默认调用付费 API。
3. 在返回的工作目录中，用宿主文件工具创建 `story.json`。素材路径相对于这个目录；不支持外部绝对路径或网址。参见本技能附带的 `schema.md`。每个有角色的镜头必须在 visual 中重复该角色完整 description。图像中的角色一致性仍需看图确认，文字检查不证明画面一致。
4. 调用 `yijuchengpian_validate`。根据真实错误修改故事后重试；最多两次，仍失败则说明问题。不得靠删除角色、留空字幕或改掉用户目标时长来绕过校验。
5. 调用 `yijuchengpian_render`。输出可能需要数分钟；超时先检查工作目录 output 中的 status.json，不能立刻重复提交。只有 completed 才报告完成，并给出工具返回的 video 路径。

## 配音和背景音乐

用户要求配音或有声成片时，设置 `voiceover: {}`，默认按镜头朗读字幕；需要不同旁白时设置每镜 `narration`。先查看状态中的中文声音可用性，无声音时说明需要安装系统语音或导入录音，不擅自改用收费服务。

用户要求自动配乐时，设置 `music: {"preset":"gentle"}`。三种本地合成风格：gentle 温柔、bright 轻快、calm 舒缓。这是简单合成配乐，不是 AI 歌曲生成。已有音乐用 `music: {"asset":"assets/music.mp3"}`，默认音量 0.18；有旁白时自动压低音乐。

`audio` 保留为导入的一条完整主音轨，与 `voiceover` 互斥，但可以和 `music` 一起用。未设置三者时仍生成无声版，不偷偷增加声音。render 会剥离视频素材原声。

配音按每镜起点对齐，短的补静音，稍长的适度加速；超过 1.10 倍仍放不下时返回错误，先缩短 narration 或征得用户同意调整时长，不截断台词。完整字段参见 schema.md。

若宿主没有 MCP，但有本地命令能力，由你从安装目录执行 `bun start doctor`、`bun start validate story.json`、`bun start render story.json`。显式说明使用的是本地命令方式，不把它算作 MCP 验证。记录安装目录，后续调用使用同一目录和工作目录。

自动配音时，屏幕字幕直接使用实际朗读的 narration（未提供则 caption），按短句音频时间显示；不要另写与旁白不同的字幕。系统声音没有情绪控制，不能称为真人或情感配音；先提供试听，用户不满意时说明限制。导入整条 audio 不具备自动字幕对齐，必须提示人工核对，不能声称已同步。

用户要求改善机械感、使用联网神经网络配音时，阅读 [免费联网配音](references/online-voice.md)。必须获得发送旁白文字的同意后启用；默认仍离线。
