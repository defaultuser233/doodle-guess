# 画个啥 · DoodleGuess

一个水彩纸风格的「你画我猜」小网页：抽一张词卡，把它画出来，让本地 AI 猜你画的是什么。

- **100 个中文词卡**，来自 Google QuickDraw 数据集；最近 30 张不会重复
- **识别完全在浏览器里完成**：模型随前端打包，画作不上传、不需要 API Key
- 水彩纸 + 蜡笔手绘的界面，自己画的图标、水彩背景和动效
- 画作保存在 IndexedDB，可回看、下载、删除；导出的 PNG 是横版藏品卡，带 Top-3 猜测与置信度
- 深色「夜桌」模式，跟随系统偏好，也可以手动切换
- 猜中后可生成分享图，支持系统分享、复制到剪贴板或下载兜底
- 自由画可以另选一张词卡，作为挑战作品收进画廊
- 核心逻辑有 Vitest + Playwright 冒烟覆盖，`pnpm check` 一条命令跑完 lint、单测和构建
- 可安装为 PWA：首次加载后离线可用，模型和字体由 Service Worker 缓存
- 画板笔迹使用二次贝塞尔平滑；识别的仍是原始笔迹点
- 画廊支持 JSON 备份 / 恢复，换设备或清缓存前可以先导出

## 快速开始

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm test      # Vitest
pnpm test:e2e  # Playwright 冒烟（使用本机 Edge，自动启动 5273 端口）
pnpm build     # 产物在 dist/，直接静态部署
pnpm preview   # 预览构建产物
pnpm check     # lint + coverage + build
```

环境：Node 22.12+、pnpm 11+（`packageManager` 已声明；本项目使用 Node 24 / pnpm 11.5.2 开发）。

## 离线 / 安装

```bash
pnpm build
pnpm preview
```

构建产物会注册 Service Worker，并预缓存页面、模型、字体和图标（约 1MB）。首次加载完成后断网刷新也能继续玩，也可以从浏览器地址栏安装为应用。`pnpm dev` 不启用 Service Worker；PWA 图标可用 `pnpm generate:icons` 重新生成。

## 安全头

生产构建会在 `<head>` 注入 CSP（`script-src 'self'`，主题初始化脚本已外置）；`public/_headers` 提供 Netlify 风格的 CSP、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy` 和 `X-Frame-Options`。其他静态托管平台可在服务器配置同样的响应头。

## 玩法

1. 首页点「开始画画」，系统随机发一张中文词卡（如「猫」「披萨」「热气球」）。
2. 在画板上作画，支持 8 色、3 档笔刷、橡皮、撤销 / 重做、清空。
3. 点「让 AI 猜猜」，AI 给出 Top-3 与把握度；Top-1 命中即算猜中。
4. 猜中会自动收进画廊；没猜中也可以手动保存，或继续补两笔再猜。
5. 「自由画」模式没有词卡和倒计时，画什么都可以，AI 仍会给出 Top-3；也可以不猜，直接保存这幅画。
6. 自由画画完可以「存为挑战」：从 100 张词卡里选一个目标，再以挑战作品保存。
7. 猜中后的结果卡和画廊详情都可以分享：优先调用系统分享，不支持时尝试复制图片，最后回退为下载。
8. 顶栏的月亮 / 太阳按钮可以在浅色纸张和深色夜桌之间切换，选择会记住。

快捷键：`Ctrl/⌘ + Z` 撤销，`Shift + Ctrl/⌘ + Z` 重做，`E` 橡皮，`B` 画笔，`Enter` 猜测。

## 测试与检查

```bash
pnpm test       # Vitest：drawing / stats / storage / classifier / theme / share / backup
pnpm test:coverage  # 覆盖率门槛（核心 lib 模块，行覆盖 ≥60%）
pnpm test:e2e   # Playwright：画 → 猜 → 存 → 画廊 → 弹窗 Esc / 备份恢复
pnpm generate:icons  # 用本机 Edge 重新生成 PWA 图标
pnpm check      # lint + coverage + build
```

`test:e2e` 通过 `playwright.config.ts` 使用本机 Microsoft Edge（`channel: 'msedge'`），并自动启动一个独立的 5273 端口开发服务器；不下载额外浏览器。其他系统可把 `channel` 改成 `chrome` 或安装 Playwright Chromium。

测试使用 Node 环境；IndexedDB 相关用例通过 `fake-indexeddb` 运行，不依赖浏览器。Canvas / 分享 / 音频 / 弹窗等浏览器能力由 Playwright 冒烟覆盖；覆盖率门槛聚焦纯逻辑模块。

## 识别是怎么做的

没有调用任何云端模型。项目用 QuickDraw 的 28×28 灰度位图训练了一个小型 MLP：

```
784 → 512 ReLU → 256 ReLU → 100 softmax
```

- 数据：100 个类别 × 1200 张（过滤低墨量后约 108,000 张训练），来自 [QuickDraw Dataset](https://github.com/googlecreativelab/quickdraw-dataset) 的 `numpy_bitmap`。
- 预处理：重放笔迹（含橡皮擦）→ 墨迹包围盒 → 等比缩放并居中 → 28×28 灰度。
- 训练：随机旋转 ±12°、缩放 0.88–1.12、平移 ±2px；Adam + label smoothing 0.05。
- 导出：int8 逐列量化，权重约 550KB，浏览器内单次推理几毫秒。
- 指标：留出集 **Top-1 59.4% / Top-5 83.9%**（100 类，见 `training/metrics.json`）；`pnpm verify:model` 在训练未使用的新样本上复核（5 个类别 100 张，Top-1 57% / Top-5 83%）。

### 重新训练（可选）

训练脚本只需要 numpy。推荐用 [uv](https://docs.astral.sh/uv/) 运行；国内网络可加清华 PyPI 镜像：

```bash
# Windows PowerShell
$env:UV_DEFAULT_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"
uv run --with numpy python training/train.py --samples 1200 --epochs 18

# macOS / Linux
UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple \
  uv run --with numpy python training/train.py --samples 1200 --epochs 18
```

脚本会把每类前 600 张 + 数据集中段的 600 张缓存到 `.cache/quickdraw/`，然后训练并覆盖：

- `public/model/model.json`（标签、层结构、量化 scale、指标）
- `public/model/weights.bin`（int8 权重 + float32 bias/scale）
- `training/metrics.json`（每个 epoch 的 Top-1 / Top-5）

> 为什么脚本里设置了 `OPENBLAS_NUM_THREADS=4`？在混合架构 CPU（P 核 + E 核）上，OpenBLAS 默认开太多线程会让这种小矩阵乘法慢一个数量级。

## 项目结构

```
src/
├─ screens/       首页、画板、画廊
├─ components/    画布、工具栏、AI 面板、结果层、弹窗、主题切换、图标
├─ lib/           分类器、笔迹预处理、IndexedDB、统计、音效、主题、分享
├─ data/          100 个类别的中英文名与 emoji
├─ styles/        设计 token、纸纹、水彩、动效、暗色主题、响应式
└─ assets/        字体（OFL）与 CC0 音效
training/          数据下载 + 训练 + 导出
docs/PRD.md        视觉、动效、交互与验收标准
docs/TODO.md       改进项与完成状态
docs/CREDITS.md    音效等外部素材的来源与许可
vitest.config.ts   单元测试配置
```

## 数据与素材许可

- **QuickDraw Dataset**：Google Creative Lab，CC BY 4.0。模型是在该数据集上训练的衍生作品。
- **ZCOOL KuaiLe**：站酷快乐体，SIL Open Font License 1.1，许可文本见 `src/assets/fonts/OFL-LICENSE.txt`。
- **音效**：来自 OpenGameArt / Freesound 的 CC0 录音（qubodup、NachtmahrTV、damsur、Fupi、EZduzziteh），裁剪与转码后随前端打包，逐条来源见 `docs/CREDITS.md`。
- 界面图标、水彩背景、纸纹、胶带与印章均为本项目自绘 / 用 SVG 滤镜生成，随项目使用。

## 浏览器支持

Chrome / Edge / Firefox / Safari 的近期版本。画布使用 Pointer Events 与 `getCoalescedEvents`，支持鼠标、触控笔和手指；识别使用普通 `fetch` + TypedArray，无需 WebGPU。分享图依次尝试 Web Share、剪贴板图片与下载；暗色模式优先读取系统偏好，也支持手动切换并记忆。

## 已知限制

- 模型只认识 100 个类别，画这 100 个词以外的东西时，AI 仍会从这 100 个词里挑一个最像的。
- 训练数据是简笔画风格；写实画法、复杂背景和文字会降低命中率。
- 画廊数据存本机浏览器；清理站点数据会一起清空，不做云端同步。
