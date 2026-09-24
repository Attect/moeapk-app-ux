# 吉祥物素材制作手册（安卓娘 · Grok Bot 大头风）

本文面向参与 MoeApk UX 设计的人：说明 `assets/chara-*.webp` 吉祥物素材的**来源、风格规范与生成方法**，以便后续增补新姿态/新表情时保持画风统一。

## 素材清单与使用约定

| 文件 | 姿态 | 用途 |
|---|---|---|
| `chara-head.webp` | 日常问候 · 明 | 「我的」页问候横幅 + LLM 对话 AI 消息头像 |
| `chara-head-night.webp` | 日常问候 · 暗（睡帽睡衣） | 「我的」页横幅（暗色主题自动切换） |
| `chara-head-hi.webp` | 眯眯笑迎宾 · 明 | 登录页迎宾 |
| `chara-head-hi-night.webp` | 眯眯笑迎宾 · 暗（睡帽睡衣） | 登录页迎宾（暗色主题自动切换） |

使用约定：

- **同一构图必须出明暗两版**：暗色版给角色换**靛紫色睡帽（带绒球）+ 深色荷叶边睡衣领口**，姿态与表情不变。
- HTML 放两张 `<img>`，分别挂 `d-only` / `n-only` 工具类，CSS 按主题自动切换（见 `css/app.css`）。
- **克制使用**：素材只出现在品牌/问候/助手头像位，不做背景装饰，避免 UI 性能下降。
- 素材与 logo、MoeApk 字体同属品牌素材，**不适用 MIT 许可**（见 `assets/LICENSE.txt`）。

## 素材来源

- **角色设定图**：在 <https://moeapk.com/prototype> 页面获取（多角度视图 + 面部特写 + 服装分层 + Q 版形象）。
- **AI 生图工具套件**：CLI-Diffusion —— <https://cnb.cool/Muka/CLI-Diffusion>。使用其中的 **Qwen-Image 2.1**（统一文生图 + 图像编辑，原生 RGBA 透明输出）按「四段式」流水线生成。

## 风格规范（Grok Bot 大头）

原型采用 X 上流行的 Grok Bot PFP 风格，要点（优先级从高到低）：

1. **眼睛**：两个接近黑色的纯色**竖胶囊**（圆角长条，长约为宽的 2.5–3 倍），等大、平行；**无瞳孔/虹膜/高光/睫毛/眉毛**。差分可变体为眯眯笑眼（∩ 形弯眼）。
2. **脸**：大而圆润的机器人脸，平滑色块；**不画嘴和鼻子**；脸颊两团小而浅的**椭圆腮红**（低饱和平涂）。
3. **构图**：头部占画面绝大部分，微歪头（10–15°，可左可右）做"窥视"感；不画身体和手，底部只露一点领口。
4. **头发/识别物**：头发简化为几个大而平滑的色块，保留刘海轮廓与呆毛；**猫耳必须保留**（角色核心识别物）。
5. **上色**：几乎无描边，靠相邻色块区分形状；扁平柔和，最多一层宽阔微弱的阴影。
6. **背景**：**透明**（RGBA，官方 Grok Bot 为近黑纯色底，原型为叠加在渐变卡片上刻意改为透明）。

## 生成流程（Qwen-Image 2.1 四段式）

> 工具套件的模型与 exe 用法见其仓库文档。显存参考（RTX 3090 24G）：text-encode ≈17.5G / diffuse ≈15G / vae 两段 ≈3G，**四段必须串行**。

### 1. 从设定图裁剪参考图

按设定图区域裁出**面部特写**（`crop-face.png`，含完整头部与少量肩），边缘的面板线/文字用纯白涂掉。

### 2. 四段式生成（每张素材跑一次）

```bash
# 1) 参考图 → VAE latent（--output-resolution 控制目标面积档位）
./bin/qwen-image-2-1-vae-encode.exe --model-dir models/qwen-image-2-1 \
  --image crop-face.png --output ref.q21-latent --output-resolution 640

# 2) 提示词 + 参考图 → 条件
./bin/qwen-image-2-1-text-encode.exe --model-dir models/qwen-image-2-1 \
  --prompt "<见下方模板>" --image crop-face.png --output out.q21-cond --output-resolution 640

# 3) 去噪采样（40 步、无 CFG、固定种子便于复现）
./bin/qwen-image-2-1-diffuse.exe --model-dir models/qwen-image-2-1 \
  --conditioning out.q21-cond --ref-latent ref.q21-latent \
  --steps 40 --seed 42 --output out.q21-latent

# 4) VAE 解码 → RGBA PNG
./bin/qwen-image-2-1-vae-decode.exe --model-dir models/qwen-image-2-1 \
  --latent out.q21-latent --output out-rgba.png
```

### 3. 提示词模板

**基础模板**（所有姿态共用，RGBA 透明背景为官方固定开头/结尾）：

```
This is an RGBA image with transparency. Redraw this anime catgirl as a minimalist
2D "Grok bot" style robot icon head: one big round smooth face filling most of the
frame. No mouth and no nose at all. Two small pale oval blush marks on the cheeks in
flat low-saturation color. Simplify her light brown hair into a few big smooth flat
color blocks keeping the bangs silhouette and ahoge, keep the cat ears. Almost no
outline strokes: shapes are separated by color blocks only, flat soft coloring with
at most one wide faint shadow layer. The whole head is complete and fully visible,
not cropped by the canvas. The image has alpha channel and the background is
transparent.
```

**姿态差分**（追加在基础模板后）：

- 日常问候（胶囊眼 + 歪头）：
  `The eyes are exactly two solid near-black vertical capsule shapes: rounded bars about 2.5 to 3 times taller than wide, identical size, parallel to each other, tilting together with the head. No pupils, no iris, no highlights, no eyelashes, no eyebrows. The head tilts clockwise about 15 degrees as if peeking in from the lower left.`
- 眯眯笑迎宾（∩ 弯眼 + 小星星）：
  `The eyes are two happy closed smiling arcs: solid near-black upside-down-U shapes (bent capsules, cheerful welcoming look), identical and parallel. The head tilts clockwise about 10 degrees in a friendly greeting pose. Two tiny four-point sparkle symbols float beside the head.`

**服装差分**（二选一，追加在最后）：

- 明（日常装）：`A tiny hint of light green collar at the bottom edge.`
- 暗（睡帽睡衣）：`She wears a dark indigo-purple droopy nightcap on her head between the cat ears, the cap tip hanging to one side with a small pom-pom, and a dark frilly pajama collar at the bottom edge.`

### 4. 后处理（入库）

```python
# PIL：裁透明边 → 等比缩放到高 400px → WebP(q86, method=6)
# 目标：单张 ≤ 35KB，全套 ≤ 150KB
im = im.crop(im.split()[3].getbbox())
im = im.resize((round(w*400/h), 400), Image.LANCZOS)
im.save('assets/chara-<name>.webp', 'WEBP', quality=86, method=6)
```

## 增补新姿态时的检查单

- [ ] 基础模板逐字未改（画风锚点）；只追加姿态/服装差分句
- [ ] 胶囊眼/无嘴鼻/腮红/猫耳/呆毛五项齐全；无瞳孔高光
- [ ] 同一姿态同时出明（绿领口）暗（睡帽睡衣）两版，同名加 `-night`
- [ ] 背景透明（alpha 低值区 ≥30%）；裁边后主体居中
- [ ] 入库前压缩到高 400px WebP q86；引用处挂好 `d-only`/`n-only`
- [ ] 不再使用的旧素材**及时从 `assets/` 删除**（RGBA 母版不入库）
