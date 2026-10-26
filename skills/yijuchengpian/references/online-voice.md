# 可选免费联网配音

用户选择更自然的联网声音时使用。需要明确说明：旁白文字发送到 Microsoft Edge 在线语音服务；由 edge-tts 第三方客户端接入，无需付费 API 密钥。本接口不是有服务保障的商业语音 API，不承诺永久免费或持续可用，也不支持任意情绪标签。不向该服务上传图片、视频或用户录音。没有用户同意时继续使用离线模式。

## 安装（由工作台执行）

在一句成片工具安装目录执行 `bun scripts/setupVoice.ts`。它需要已有 Python 3，只把轻量客户端装到项目 local/voice-env，不下载语音大模型。找不到 Python 时由工作台协助安装，不能声称已安装成功。也可用 YIJUCHENGPIAN_SETUP_PYTHON 指定已有解释器；特殊环境用 YIJUCHENGPIAN_VOICE_PYTHON 指定装有 edge-tts 的 Python。

执行 doctor，onlineVoiceover.installed=true 仅表示本地依赖就绪，不证明联网成功。第一次先用用户已同意发送的一小段旁白试音。

## 制作

获得同意后才设置：

```json
{"voiceover":{"provider":"edge","allowNetwork":true,"voice":"zh-CN-XiaoxiaoNeural","networkRate":-10}}
```

Xiaoxiao 为中文女声；也可试 zh-CN-YunxiNeural 男声。networkRate 为百分比，范围 -30 至 30，默认 -10。系统模式的 rate 不影响联网模式。volume 仍控制混音音量。

整镜旁白一次合成，按服务词语时间信息生成短句字幕；字幕内容为 narration，否则 caption。服务返回的文字/时序缺失或异常时停止，不猜同步结果。超过镜头时长的处理规则与离线配音相同。

先提供短试听，再根据用户意见选择声音。免费联网声音不等于真人表演；不编造“悲伤、开心”等接口不支持的情绪参数。失败时说明具体原因，不自动改用收费服务，不反复提交。需要离线降级时向用户说明效果差异，再选择 system。
