# 故事格式

```json
{
  "title": "把月光送回家",
  "duration": 5,
  "characters": [{"id":"snail","description":"背着金色圆壳的小蜗牛"}],
  "shots": [{
    "duration":5,
    "visual":"背着金色圆壳的小蜗牛终于回到温暖的小屋。",
    "characterIds":["snail"],
    "caption":"小蜗牛终于回到了温暖的家。",
    "asset":"assets/home.png"
  }]
}
```

基础字段必填；audio、voiceover、music，以及每镜 narration 可选。总时长 2—120 秒；1—24 镜，每镜 1—30 秒，各镜合计必须等于 duration。字幕每镜 1—48 字且不含换行等控制字符，总字数至少为 duration × 1.5；超过每秒 5 字会提示阅读过快。characters 可为空数组，非空角色描述至少 4 字。图片支持 PNG/JPG/WebP，视频支持 MP4/MOV/WebM，声音支持 WAV/MP3/M4A。

图片按镜头时长展示；视频不足镜头时长时循环，超出则截断。成片固定 1280×720、25fps，等比缩放并补边，画面不裁切。不提供用户自定义 FFmpeg 参数或滤镜。

## 自动配音与背景音乐

在故事顶层加上：

```json
{
  "voiceover": {"rate":170,"volume":1},
  "music": {"preset":"gentle","volume":0.18}
}
```

这是应合并到完整故事中的音频字段，不是独立故事。`voiceover: {}` 会选择已安装的中文系统声音，逐镜朗读 caption；每镜可用 `narration`（1—160 字）同时作为配音和屏幕字幕文本，避免字幕与旁白内容不一致。voice 可指定 status 返回的已安装中文声音名称。rate 取 100—300，默认 170；macOS 是系统语速参数，Windows 映射到系统语速等级，不保证跨平台一致。volume 范围 0.1—2。

music 二选一：`{"preset":"gentle"}` 使用本地合成配乐（gentle / bright / calm）；`{"asset":"assets/music.mp3"}` 使用自己的音乐。volume 取 0.01—1，默认 0.18。自带音乐会循环到成片长度、淡入淡出，有主音轨时自动压低音乐；请使用有权使用的素材。

原 `audio: "assets/narration.wav"` 仍可使用，代表完整主音轨，短的补静音、长的截到视频长度。audio 与 voiceover 不可同时设置，均可与 music 混合。所有音频路径仍限制在工作目录内。没有音频字段时输出无声视频。

自动配音不调用收费 API：macOS 使用系统 say，Windows 使用已安装的 System.Speech 中文声音；没有中文声音或平台不支持时明确失败，可改为导入 audio。Windows 适配尚未真机验证。Linux 暂只支持导入录音及背景音乐。

旁白按镜头顺序逐段生成，时间不足时最多加速到 1.10 倍，仍过长会报错，不会直接截掉句尾。生成的 narration.wav、music.wav（内置配乐时）、mixed.wav 和 audioReport.json 保存在本次输出目录，可独立检查。最终输出为单声道 AAC。

自动配音字幕按实际合成的短句音频时间显示，停顿与镜头留白期间不继续显示上一句；烧录字幕和 SRT 使用同一时间轴。整条导入 audio 尚无自动语音对齐，字幕仍按镜头显示，必须明确提示用户核对。系统声音没有情绪模型，不能承诺真人情感效果；较慢语速和断句只能改善节奏。

## 可选联网声音

`voiceover.provider` 默认为 `system`；设置为 `edge` 时还必须 `allowNetwork: true`，表示用户已同意发送旁白文字。联网模式使用 `networkRate`（-30 至 30，默认 -10，百分比），不使用系统 `rate`。声音默认为 `zh-CN-XiaoxiaoNeural`。详见 [联网配音](references/online-voice.md)。联网字幕根据整镜语音返回的词语时序生成，保留整句自然韵律。
