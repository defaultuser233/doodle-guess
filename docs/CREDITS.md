# 素材来源与许可

页面里的字体、图标和水彩背景由本项目自己绘制 / 生成，不依赖第三方素材。音效使用外部录音，均为 **CC0（公有领域）**，可以商用、修改，不要求署名；这里的署名只为记录来源。

## 音效

| 文件 | 用途 | 原始素材 | 作者 | 许可 | 处理 |
| --- | --- | --- | --- | --- | --- |
| `src/assets/sounds/click.wav` | 按钮、开始猜测 | [Button Click Sound Effect (CC0/Public Domain)](https://opengameart.org/content/button-click-sound-effect-cc0public-domain) | qubodup | CC0 | 截取 0.10s，转单声道 44.1kHz，+6.6dB |
| `src/assets/sounds/stroke.mp3` | 落笔的铅笔声 | [Pencil Sounds](https://opengameart.org/content/pencil-sounds) 中的 `pencil_write`（原始录音：[Freesound #571800](https://freesound.org/s/571800/)） | NachtmahrTV / 打包 AntumDeluge | CC0 | 截取 0.45s，尾部 0.14s 淡出，单声道 64kbps |
| `src/assets/sounds/undo.mp3` | 撤销 / 重做 | 同上包中的 `pencil_erase`（原始录音：[Freesound #443241](https://freesound.org/s/443241/)） | damsur / 打包 AntumDeluge | CC0 | 截取 0.35s，尾部 0.12s 淡出，单声道 64kbps |
| `src/assets/sounds/success.mp3` | 猜中 | [Correct Bell](https://opengameart.org/content/correct-bell) | Fupi | CC0 | 截取 1.5s，尾部 0.45s 淡出，单声道 64kbps |
| `src/assets/sounds/fail.mp3` | 没猜中 | [Error](https://opengameart.org/content/error) | EZduzziteh | CC0 | 截取 0.40s，尾部 0.12s 淡出，单声道 64kbps |

全部音效合计约 36KB，随前端一起打包，并通过 Service Worker 离线缓存。

## 词卡与识别模型

- 词卡与识别模型来自 [Google QuickDraw](https://quickdraw.withgoogle.com/data) 数据集（CC BY 4.0），训练与导出脚本在 `scripts/` 与 `docs/` 中，见 README 的「模型」一节。

## 字体

- 站酷快乐体（ZCOOL KuaiLe），SIL Open Font License 1.1，随仓库放在 `src/assets/fonts/`。
