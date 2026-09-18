# MoeApk App Web 原型

MoeApk App（`../app`，当前 0.9.5/26）UX 的 1:1 Web 还原。**UX 调整先在这里改、验证，再同步到 Compose。**

## 起法

- 直接双击 `index.html`（数据内嵌为 JS，file:// 可用）；
- 或 `run.cmd`（python http.server 8095）后访问 <http://127.0.0.1:8095>。
- 桌面浏览器显示手机框；开发者工具切移动视图或直接窄窗口即全屏。
- 右上角"明/暗"切换主题（App 侧跟随系统，无手动开关；原型提供切换仅便于对比验证）。
- URL hash 与导航同步（`#apk`、`#apk/catalog-detail/moeapk-service`），可直接直达某屏，浏览器前进/后退可用。

## 工作约定

1. **改 UX 只改本目录**，走查满意后再把同样的结构调整落到 `app/src/main/java/com/moeapk/ui/` 的 Compose 代码。
2. 页面 ↔ Compose 源文件对照表见下；新增页面两边同步新增。
3. 页面状态放 `S.x.<key>`（易失）或 `S`（全局：登录态、设置项）；跨页跳转用 `nav.push/pop/goTab`；子页 id 由 `ui.js` 的 `registerScreen` 自动收集进 `SUB_PAGES`（无需再手工维护数组）；模拟壁纸→AI 放大的跳转在 `js/screens/wallpaper-dialog.js` 的 `wp-parallax-set`。
4. 下载/生成等长流程用 `mock.startJob(key, label, ms, phases)`，真实下载队列在 `js/mock.js`。
5. 数据更新：改 `website/mukaapp_moeapk/site_moeapk` 后跑 `powershell -File tools/extract-data.ps1`（注意脚本会覆盖演示数据，需手工合并回 demo 项）。
6. 本目录是纯静态文件，不进 Gradle 构建；随 app 仓提交。
7. 改 js/css 后把 `index.html` 里所有 `?v=N` 一并递增（防 python http.server 启发式缓存导致浏览器用旧文件）。

## 页面 ↔ Compose 对照表

| 原型 | Compose 源 |
|---|---|
| `js/screens/apk.js`（tab:apk + 详情） | `ui/apk/ApkScreen.kt`、`ApkHomeScreen.kt`、`CatalogScreens.kt`、`OpenScreens.kt` |
| `js/screens/assets.js`（tab:assets 素材网格 + asset 查看器） | **新设计（2026-09-18）**：取代 ui/wallpaper/WallpaperCenterScreen.kt |
| `js/screens/ai.js`（tab:ai 入口枢纽 + ai-queue 任务队列子页） | **新设计（2026-09-18）**：取代 ui/ai/AiScreen.kt 五子页结构 |
| `js/screens/ai-llm.js`（llm / llm-config 子页） | `LlmBench.kt`（Agent 化改造后）；llm-config 为新增设计 |
| `js/screens/ai-diffusion.js`（diffusion / diff-config 子页） | `DiffusionBench.kt`；diff-config 为新增设计 |
| `js/screens/ai-tts.js`（tts / tts-voices 子页） | `TtsBench.kt`；tts-voices 为新增设计 |
| `js/screens/ai-models.js`（models / model-search） | `ui/ai/ModelHubScreen.kt`、`ModelSearchScreen.kt` |
| `js/screens/download.js`（downloads 子页） | `ui/download/DownloadScreen.kt` |
| `js/screens/mine.js` | `ui/mine/MineScreen.kt` |
| `js/screens/pages-account.js`（login/register/account/security） | `ui/account/LoginScreen.kt`、`RegisterScreen.kt`、`AccountScreen.kt`、`SecurityScreen.kt` |
| `js/screens/pages-account.js`（update） | `ui/about/UpdateScreen.kt` |
| `js/screens/about.js` | `ui/about/AboutScreen.kt` |
| `js/screens/wallpaper-dialog.js`（壁纸对话框） | `WallpaperCenterScreen.kt` 的 SetWallpaperDialog / 视频壁纸对话框 |
| `js/store.js`（导航栈/Tab） | `ui/AppRoot.kt`（MainTab/SubPage/Crossfade） |
| `js/mock.js`（下载队列/任务进度/AI 任务队列） | `:download` DownloadManager |
| `js/ui.js`（组件库/渲染 + registerScreen 子页自动收集） | 各 M3 组件 + 本仓 EntryCard/SectionColumn 等私有组件 |
| `css/app.css`（设计令牌） | `ui/theme/Theme.kt`（dynamic color，fallback 种子 #E8A562） |

## 当前设计（2026-09-18 两轮调整）

### 导航

1. 底部导航四 Tab：**APK / 素材 / AI / 我的**。原"下载"Tab 并入"我的 → 下载任务"（downloads 子页）。

### 素材

2. **素材 Tab**：网格列表，首格"导入素材"（模拟系统文件选择器）。素材类型：图片 / 视频 / 音频 / **3D 点云**（点云是图片的处理产物，作为一等素材）。
3. **素材查看器**（相册式，asset 子页）：左右切换浏览（序号含类型标签）、按类型变化的底部工具栏：
   - 图片：设为壁纸 / 分享 / AI 放大 / AI 扩图 / 3D 点云处理
   - 视频：设为壁纸（视频壁纸对话框）/ 分享 / 删除
   - 音频：波形舞台 + 播放，分享 / 删除
   - 点云：点云舞台 + 设为壁纸 / 分享 / 控制面板 / 删除
4. **耗时处理**在工具栏上方出现进度条：步骤、百分比、取消。完成去向：放大→存相册；扩图→存为新图片素材；
   **点云→存为点云素材并直接切到结果查看**。
5. **点云查看**：姿态感应（俯仰/左右倾斜滑杆演示 + 自动摇摆模拟陀螺仪）、查看方式（强度/缩放）、
   渲染性能（点云精度=渲染点数百分比）；控制面板**默认收起**，点舞台右上角齿轮展开。壁纸中心已拆除。

### AI

6. **AI Tab 为入口枢纽**：AI 任务队列 + 模型管理 / LLM 对话 / 图片生成 / 语音生成 四个独立入口条目，
   各自进入独立子页。AI 放大不再单列（在素材查看器对图片操作）。
7. **AI 任务队列**（ai-queue 子页）：所有 `mock.startJob` 的任务自动入队，运行中显示步骤+进度+取消，
   已完成可单个清除或清空；文件下载仍在"我的 → 下载任务"。
8. **LLM 对话**（llm 子页，Agent 化，经典助手布局）：
   - 主区域为对话区；进入即**新对话界面**（空态提示），首条消息自动建会话（标题取首条消息摘要）、
     按所选模型下载/加载，就绪后自动回复。
   - 底部输入区：**模型选择**（chip 点开对话框，新对话态选 modelSel；空会话直接换模型；
     有消息的会话换模型则另起新对话）+ **上下文用量**（token 数/上限 + 占用条，超 80% 变红）+
     图片附件 + 输入框 + 发送。
   - 顶部右侧菜单键打开**侧边抽屉**：会话列表（点按切换、✕ 删除、新建对话），抽屉底部为**推理设置**
     （按当前模型进入 llm-config）。
   - 图片附件仅多模态模型可用（否则系统消息/Toast 提示忽略）；token 估算（字数/2，图片 512），
     接近上限自动压缩（tokens×0.5 + 系统消息）。
   - 推理配置（llm-config 子页）：上下文长度/种子/温度/推理方式 CPU·GPU·NPU/线程数/批大小/KV 缓存量化，
     **按模型独立保存**。
9. **图片生成**（diffusion 子页，与 LLM 同范式）：主区域为当前结果（大图 + 参数信息 + 提示词 + 保存到素材/相册，
    文生图结果可"作为底图"一键转图生图）；底部输入区：文生图/图生图切换 + 模型选择 chip（对话框内下载/换用）、
    图生图底图（素材库选取 + 重绘幅度）、采样步数、提示词 + 生成。右上角菜单抽屉=生成历史（切换/删除/新建），
    底部"生成设置"子页：采样器/CFG/种子/输出尺寸，**按模型独立保存**。
10. **语音生成**（tts 子页，与 LLM 同范式）：主区域为当前合成结果（大播放键 + 波形 + 文本 + 保存到素材），
    未下载模型时显示下载卡；底部输入区：音色选择 chip（对话框含音色管理入口）、CPU/NPU、文本 + 合成。
    右上角菜单抽屉=合成记录（切换/删除/新建），底部"音色管理"子页：从素材音频克隆新音色 + 已保存音色选用/删除。

## 与真机的刻意差异（原型简化）

- 动态取色不可还原，统一用 fallback 种子色 #E8A562（+M3 baseline 其余角色）。
- 开源条目图标用首字占位图（原型离线，不请求网络图标）。
- 下拉刷新为"点击模拟"链接；点云预览用 CSS 粒子舞台代替 GL 渲染。
- AI 对话/生图/语音结果均为模拟数据，用于验证布局与流程，不验证模型效果。
