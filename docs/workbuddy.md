# 工作台接入参考（供 AI 执行）

普通用户请看 [三步使用教程](start.md)。以下为工作台执行安装和连接时的技术参考，不要求用户手动输入命令。完整技能安装包在 [GitHub 下载页](https://github.com/hueyzhao/yijuchengpian/releases/latest)，也可使用仓库源码。

你需要安装两个部分：**本地制作工具**负责渲染，**技能**负责指导 WorkBuddy 的模型。只导入 Skill 不会自动获得渲染能力。

## 一、下载并安装本地制作工具

1. 使用用户提供的源码包或技能包中的 assets/app，放到固定目录，如 `文稿/yijuchengpian`。不要放在临时目录。
2. macOS：在终端进入这个目录，执行 `bash install.command`。文件可执行时也可双击；系统拦截时优先采用上述命令，不关闭系统安全保护。
3. Windows：在此目录打开 PowerShell，运行 `./install.ps1`。如果组织策略禁止执行脚本，按提示联系管理员，或安装 Bun 后手动执行下方三个命令；不要全局关闭执行策略。
4. 安装需要联网下载 Bun（缺失时）、项目依赖与 FFmpeg，不下载 AI 模型，不要求充值 API。完成后显示工作目录及 `local/mcp.json` 路径。

已安装 Bun 的手动步骤：

```sh
bun install --frozen-lockfile
bun run setup
bun run demo
```

第三条会创建原创四幅插画和 20 秒无声字幕故事片。完成后打开返回的 video 路径确认文件能播放。无需你提供旧素材。

## 二、在 WorkBuddy 接入本地工具

1. 打开 WorkBuddy 本地桌面客户端，在「专家·技能·连接器」中进入「连接器」。查找自定义 MCP 的添加/配置入口（不同版本名称可能不同）。
2. 打开安装目录中的 `local/mcp.json`。如果界面支持 JSON 配置，复制其中的配置；如果是表单，选择 **stdio**，逐项填写 `command`、`args`、`env`。不要把本机路径替换成 GitHub 网页地址。
3. 配置里 `command` 是 Bun 的绝对路径，`args` 是本地 mcp.ts 文件，`env.YIJUCHENGPIAN_WORKSPACE` 是固定工作目录。仅添加 yijuchengpian，不覆盖已有其他连接器。
4. 在 WorkBuddy 正常授权流程中允许这个本地连接。连接后应出现 `yijuchengpian_status`、`yijuchengpian_validate`、`yijuchengpian_render` 三个工具。
5. 发出：“请只调用 yijuchengpian_status，返回真实结果，不调用外部 API。”应返回产品名、版本、工作目录和 FFmpeg 版本。没有工具时先解决配置问题，不要求模型猜测。

此教程依据官方本地 stdio 接入格式编写，未在你的 WorkBuddy 窗口中完成点击验收。如果你的版本没有自定义 MCP 入口，请先使用下方 CLI 路径，不把它当成 MCP 已通过。

## 三、导入技能

1. 将安装目录的 `skills/yijuchengpian` 文件夹压缩成 ZIP。包内保留 `SKILL.md` 和 `schema.md`，不要把整个源码或 node_modules 打包进去。
2. WorkBuddy 左侧「专家·技能·连接器」→「技能」→「添加技能」→「上传技能」，选择 ZIP。
3. 在本地任务中选择一句成片，工作目录建议选安装后的 `workspace`。如果需要读写该目录，按宿主提示授权。

发行包为“一句成片-0.3.1-技能安装包.zip”，根目录含技能，assets/app 含工具源码。上传技能本身不等于发布付费商品。

## 四、第一次使用：先验证，再创作

先运行安装目录中的 `bun run demo`，然后发送：

> 使用一句成片。先调用 yijuchengpian_status，然后校验 demo/story.json。校验通过后调用 yijuchengpian_render，生成 20 秒视频。不得调用付费 API，不下载模型。只报告工具真实返回的文件路径；未提供音频，输出无声字幕版即可。

正常会返回一个新的视频路径、SRT 路径和状态 completed。打开 MP4 检查字幕、时长与画面。遇到工具超时不要反复点击：先查看 workspace/output 中最新目录的 status.json，确认之前任务是否仍在运行。

做自己的故事：把图片、视频与可选录音复制到 `workspace/assets`，然后发送：

> 用一句成片做一段 20 秒温暖的小故事。请先查看 assets 中实际存在的素材，据此写完整剧情，分成四镜，每镜 5 秒。角色描述在每镜保持完整一致。创建符合技能格式的 story.json，校验通过再本地合成。不调用外部付费 API。没有配音就先生成无声字幕版。

注意：素材要与故事内容相符；自动文字校验只能发现描述遗漏，不能证明画面里的人物一致。建议制作前先检查分镜与素材。

## 五、没有 MCP 入口时的备用方式

让 WorkBuddy 打开源码安装目录，读取 `skills/yijuchengpian/SKILL.md`，明确要求使用 CLI：

> 使用一句成片本地 CLI，先运行 bun start doctor，再运行 bun start validate demo/story.json，成功后运行 bun start render demo/story.json。不要安装其他软件或调用外部 API。请明确说明这是 CLI 路径，不是 MCP 接入验证。

若提示 bun 找不到，使用安装时输出配置里的 command 绝对路径代替 bun。命令执行目录必须是源码安装目录；其默认素材目录为 workspace。

## 六、常见问题与费用

| 现象 | 处理 |
|---|---|
| 找不到 MCP 工具 | 确认本地任务、连接启用、路径没有移动、宿主正常批准连接 |
| FFmpeg 下载失败 | 检查网络后重新执行安装；有系统 FFmpeg 可设置 YIJUCHENGPIAN_FFMPEG |
| 中文字体缺失 | 安装中文字体或设置 YIJUCHENGPIAN_FONT 的绝对路径 |
| 提示角色描述遗漏 | 按错误提示补齐 visual，不能删掉角色定义绕过 |
| 素材越界/不存在 | 把素材复制到 workspace 内，story.json 填相对路径 |
| 视频没有声音 | 告诉 AI“用中文系统声音配音并加温柔配乐”；先检查系统中文声音。也可导入 audio。 |
| 等待过久 | 查看 output 中 status.json；长片耗时依配置而定，不重复提交 |

本地合成没有 API 费用；首次下载有网络流量，运行消耗电脑资源。WorkBuddy 自身的模型额度仍按其账号规则计算。此版本不含充值接口，也未验证付费云端技能调用本地工具。

官方依据：[技能导入](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)、[连接器与 stdio](https://open.workbuddy.cn/docs/connector)。
