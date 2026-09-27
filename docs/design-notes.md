# 设计文档：MoeApk App UX 原型

本文档记录原型的设计沿革、页面结构与工作约定。原型对应 App 0.10.3/30（App 本体为私有项目，下文对照表中的 Compose 源文件仅供理解结构对应关系）。

## 起法

- 直接双击 `index.html`（数据内嵌为 JS，file:// 可用）；
- 或 `run.cmd`（python http.server 8095）后访问 <http://127.0.0.1:8095>。
- 桌面浏览器显示手机框；开发者工具切移动视图或直接窄窗口即全屏。
- 右上角"明/暗"切换主题（App 侧跟随系统，无手动开关；原型提供切换仅便于对比验证）。
- 右上角"横屏"把预览框切为横屏（1024×680，localStorage 记忆），用于验证横屏/平板布局；也可用 `?frame=land / ?frame=port` 直达。
- URL hash 与导航同步（`#apk`、`#apk/catalog-detail/moeapk-service`），可直接直达某屏，浏览器前进/后退可用。

## 工作约定

技术约定（状态管理、导航、任务模拟、`?v=N` 递增等）统一维护在仓库根目录的 [AGENTS.md](../AGENTS.md)，本文不再重复。两条项目级原则：

1. **改 UX 只改本仓库**，走查满意后由维护者把同样的结构调整落到 App 的 Compose 代码；
2. 新增页面两边同步新增（对照表见下）。

## 页面 ↔ Compose 对照表

> Compose 源位于私有 App 仓，列出仅供理解"原型页面 ↔ 实际实现"的结构对应关系，贡献者无需访问。

| 原型 | Compose 源 |
|---|---|
| `js/screens/apk.js`（tab:apk + apk-search 搜索子页 + 详情 + favorites 收藏子页） | `ui/apk/ApkScreen.kt`、`ApkHomeScreen.kt`、`CatalogScreens.kt`、`OpenScreens.kt`、`ApkSearchScreen.kt`、`ApkRepo.kt`；收藏 `ui/favorites/FavoritesScreen.kt` + `FavoriteRepo.kt` + `:core FavoritesPref` |
| `js/screens/assets.js`（tab:assets 素材网格 + asset 查看器） | `ui/assets/AssetsScreen.kt`、`AssetViewerScreen.kt`、`AssetDialogs.kt`、`AssetOps.kt` + `:assets`（`AssetStore`/`AssetImporter`/`AssetThumbnails`/`AssetMigrator`） |
| `js/screens/ai.js`（tab:ai 入口枢纽 + ai-queue 任务队列子页） | `ui/ai/AiHubScreen.kt`、`AiQueueScreen.kt` + `:ai InferenceHub`/`InferenceQueue` |
| `js/screens/ai-llm.js`（llm / llm-config 子页） | `ui/ai/LlmScreen.kt`、`LlmConfigScreen.kt` |
| `js/screens/ai-diffusion.js`（diffusion / diff-config 子页） | `ui/ai/DiffusionScreen.kt`、`DiffConfigScreen.kt` |
| `js/screens/ai-tts.js`（tts / tts-voices 子页） | `ui/ai/TtsScreen.kt`、`TtsVoicesScreen.kt` |
| `js/screens/ai-models.js`（models / model-search） | `ui/ai/ModelHubScreen.kt`、`ModelSearchScreen.kt` |
| `js/screens/download.js`（downloads 子页） | `ui/download/DownloadScreen.kt`（入口在 我的 → 下载任务） |
| `js/screens/mine.js` | `ui/mine/MineScreen.kt` |
| `js/screens/pages-account.js`（login/register） | `ui/login/LoginScreen.kt`、`RegisterScreen.kt` |
| `js/screens/pages-account.js`（account/security） | `ui/account/AccountScreen.kt`、`SecurityScreen.kt` |
| `js/screens/pages-account.js`（update） | `ui/about/UpdateScreen.kt` |
| `js/screens/about.js` | `ui/about/AboutScreen.kt` |
| `js/screens/wallpaper-dialog.js`（壁纸对话框） | `ui/assets/AssetDialogs.kt`（设桌面/锁屏/双设、动态壁纸）、`ui/wallpaper/PointCloudPreviewScreen.kt`（点云预览/取景） |
| `js/store.js`（导航栈/Tab） | `ui/AppRoot.kt`（MainTab + `NavEntry` 参数栈）、`ui/UiBus.kt`（通用跳转） |
| `js/mock.js`（下载队列/任务进度/AI 任务队列/toast 撤销动作/网络模拟） | `:download` DownloadManager；AI 任务队列 `:ai InferenceQueue` + `InferenceHub`；toast/撤销 `ui/UiFeedback.kt` |
| `js/ui.js`（组件库/渲染 + registerScreen 子页自动收集 + 回顶/引导/输入聚焦） | `ui/CommonUi.kt`（`ScrollToTopBox`/`SkeletonBox`/`EmptyState`/`OnboardingTip`/`bringIntoViewOnFocus`）+ 各 M3 组件 |
| `css/app.css`（设计令牌） | `ui/theme/Theme.kt`（dynamic color；fallback MoeApk 主题：樱粉 #E94E8A 系渐变、玻璃表面、彩色软阴影；0.22s 明暗颜色过渡） |

> **App 侧对齐状态（2026-09-18）**：上表所列全部页面已按原型落到 Compose（壳层/素材/AI/APK + 主题过渡）。原型仍是 UX 的唯一变更入口（见「工作约定」第 1 条）。

## 设计沿革

### 第十二轮（2026-09-27，下拉刷新指示器定案收口）

**只换主题色，不改形状。** 原第十轮给下拉刷新指示器定的「玻璃圆底（backdrop 模糊 + 悬浮阴影）
+ 樱粉圆环」，在 App 落 Compose 时翻车（0.11.2 真机事故）：① 模糊取样的是页面内容层、
阴影是外部绘制层，都不随 M3 指示器自身的 `alpha=0` 一起隐藏 → 列表**闲置时**顶栏下方
常驻一枚灰紫圆盘残影；② 半透明圆底再与 M3 自带 `tonalElevation` 叠加，把正圆糊成灰边
（「指示器不圆了」）。教训：**给 M3 `Indicator` 这类自带隐藏动画的组件加外部装饰，必须
先确认装饰是否随其内部 alpha 收起**——回顶键之所以没这问题，是因为它整个包在
`AnimatedVisibility` 里，装饰天然被门控。

定案：容器给**实色**主题表面（`surface-highest` / App 侧 `surfaceContainerHighest`），
圆环给 `primary`，**不加 backdrop 模糊、不加悬浮阴影**，形状与升降动画交回 M3 自己。
原型侧同步收口 `.ptr-indicator`。

### 第十一轮（2026-09-27，原型全屏审查修正）

对原型做了一次全屏走查 + 代码审查，修五处（前三项 App 侧本就正确或无此结构，主要为原型自身缺陷）：

1. **`remove` 图标缺失**：生图页「负向提示词」折叠按钮引用了从未定义的 `remove`，
   回退成 ⓘ（info）图标。补 Material minus 路径。
2. **模型中心「＋ 从手机导入」折行**：该行（导入 + 排序 + 三个 chip）空间紧张，
   按钮文字被挤成两行。`.tbtn` 加 `nowrap` 工具类处理（App 侧对应：TextButton 内
   Text 加 `maxLines=1, softWrap=false`）。
3. **模型中心吸顶碰撞**：分类 chip 行吸顶（top:-8px 满宽横带）与分组标题胶囊吸顶
   （top:6px）同区重叠互压。定案：本页分组标题改为吸在分类行下沿（`.mdl-page
   .section-title { top: 44px }`）。（App 侧分组标题本就不吸顶，无此问题。）
4. **长按进入多选即被取消**：长按 500ms 进入多选并选中该项后，松手那一下 click 会
   命中（重建后的）同一素材格，把刚选中的项又切掉。定案：长按触发后置 `lpFired`，
   紧随的 click 吞掉一次（每次 pointerdown 复位）。（App 侧 `combinedClickable`
   的 onLongClick 原生互斥，无此问题。）
5. **点云姿态滑杆与自动摇摆互踩**：sway 的 CSS 动画覆盖 inline transform，开着摇摆时
   拖「姿态·俯仰/左右」滑杆毫无效果。定案：拖姿态滑杆即自动关闭摇摆（对齐 App 侧
   点云预览 `onDragStart { sway = false }` 的既有行为）。

另：清理两处代码卫生——`mine.js` 误在 render() 内注册 action（每次渲染重复注册）、
`assets.js` 点云舞台一处恒空字符串拼接的死代码。

### 第十轮（2026-09-27，真机走查五项修正）

真机反馈五个界面问题，全部定案（App 侧同步 Compose）：

1. **引导横幅「知道了」永久生效（I1 修订）**：原先已读标记只在会话内存（`S.seen`），
   冷启动/刷新后每个 Tab 的顶部提示反复弹出。定案：已读集合**持久化**
   （原型 localStorage `proto-onboard-seen`，App 侧对应新增 `:core OnboardPref` DataStore），
   每个 Tab 的引导全程只出现一次。横幅保持**悬浮于底栏之上**的形态（不占布局流），
   消除它不引起任何内容位移——App 侧原先把横幅内嵌在内容顶部（在流内占位），
   消除后内容整体上跳，是「APK 页分类标签被标题栏遮挡」观感的根因，同步改为悬浮覆盖。
2. **APK 分类标签行上边距**：分类行 padding 上 6px 是配合「顶部有引导横幅」定的，
   横幅悬浮化后分类行直接贴顶栏下沿显挤；分类行保持 上 6 下 10 不变，
   由内容区顶部 padding 承担间距（顶栏到分类行的视觉间距 = 8+6=14px），不再依赖横幅占位。
   **App 侧对应**：App 内容区无顶部 padding，`ApkScreen` 分类行 padding 上 6→**14dp** 对齐。
3. **详情返回还原分类页与滚动位置**：新增**滚动位置记忆**（`S.scrollMem`）——
   屏标识 = `tab:apk/apps`（tab+子分类）/ `sub:catalog-detail/xxx`（子页+参数）；
   切屏时把旧屏位置记入，回到旧屏（详情返回、切回 Tab、切换子分类）自动还原；
   同屏重渲染（输入过滤、显隐开关等）保持原位。弹栈/切 Tab 时**丢弃被离开子页的记忆**
   （重进子页从顶部开始）。**App 侧对应**：`AppRoot` 的 Crossfade 内容包
   `SaveableStateHolder.SaveableStateProvider`（键：Tab 按名、子页按 page+arg+序号），
   否则页面离屏即销毁 `rememberSaveable`（详情返回回「首页」的根因）；
   弹栈后延迟清理被弃子页的保存态。
4. **下拉刷新指示器主题色**：定案形态 = 悬浮于内容顶部中央的玻璃圆（玻璃底 + 1px
   描边 + 悬浮阴影），圆环用 `--primary` 樱粉；刷新期间**列表保持原位可见**（原先模拟
   把整列表替换为菊花，内容跳动）。原型新增 `.ptr-indicator`；**App 侧对应**：
   `PullToRefreshBox` 默认指示器容器/圆环色不跟主题，统一封装 `MoePullToRefreshBox`
   （`PullToRefreshDefaults.Indicator` 显式 `containerColor=玻璃圆底`、`color=primary`），
   APK 首页/应用/游戏/开源四处共用。
5. **chrome 层减薄**：顶栏 64→**52px**、底栏 80→**64px**（新增 `--topbar-h`/`--navbar-h`
   尺寸令牌，toast/回顶键/引导横幅/横屏 rail 偏移/点云舞台 inset 全部改由令牌推导）。
   **App 侧对应**：`CenterAlignedTopAppBar`/`NavigationBar` 的 M3 默认 64/80dp 不可调，
   换自研 `AppTopBar`（52dp + 状态栏 inset）与细底栏（64dp + 手势区 inset），
   顶栏动作槽（`TopBarActions`）行为不变。

顺带修复一个存量缺陷：同屏重渲染（如滚动过 480px 触发回顶按钮显隐）会重建 DOM
把滚动位置归零——由第 3 条的「同屏重渲染保持原位」一并解决。

### 第九轮（2026-09-27，APK 分类页真机走查修正）

真机反馈五个问题，全部定案（App 侧同步 Compose）：

1. **搜索迁出列表**：应用/游戏/开源分类页内嵌搜索框常驻列表顶部，占屏且随滚动占位。改为
   **分类页顶栏右上角 🔍 按钮 → 独立搜索子页（apk-search）**：进入自动聚焦，按搜索域
   （应用/游戏/开源，开源另匹配许可）过滤，清空键回到空态；返回即回列表。列表页只保留
   标签筛选行。`ui.js` 顶栏动作槽随之支持 Tab 页（`topRight` 可为对象或函数，函数随
   `S.apkSub` 显隐——首页不显示搜索钮）。**App 侧对应**：`CatalogListScreen`/`OpenListScreen`
   移除搜索框，经 `TopBarActions` 注册 🔍；新增 `SubPage.APK_SEARCH` + `ApkSearchScreen.kt`。
2. **分类标签行收高 + 上下对称留白**：chip 32px 高（原 34）、padding 6/14（原 7/16）；
   `.chip-row` 上下 8px 对称（原 10/6 上松下紧，激活光晕在滚动容器下沿被裁）；APK 分类行
   独立为 `.apk-tabs`（贯通屏宽负 margin 保留，上 6 下 10，给激活光晕留位）。
   **App 侧对应**：chips 显式 `height(32.dp)`，分类行 padding 改上 6 下 10。
3. **列表图标槽固定 48×48**：App 侧 `EntryCard` 用 `IntrinsicSize.Min` + `fillMaxHeight`
   推导图标高，`aspectRatio` 的本征测量把高度顶到卡宽，出现失控巨图。定案：图标槽**固定
   48×48 + Crop**（原型 `.avatar` 同步显式 `height:48px`），不再由内容推断。
   **App 侧对应**：`EntryCard` 图标改 `.size(48.dp)`；`OpenIconLoader` 解码后限 192px 省内存。
4. **详情页完整简介**：`entryCard` 新增 `full: true`（`.entry-summary.full` 取消两行 clamp），
   应用详情/开源详情启用；列表卡仍两行截断。**App 侧对应**：`EntryCard` 加
   `summaryMaxLines` 参数，详情页传 `Int.MAX_VALUE`。
5. **开源详情只列 APK 下载项**：发行版资产按 `.apk` 后缀过滤（忽略大小写），源码包/校验和等
   不再出现；该版本无 APK 时给提示并引导「发行版页面」。演示数据 kireibox 追加一条
   checksums.txt（非真实快照内容，供走查验证过滤生效）。

顺带修复两个存量缺陷：应用/游戏子页 `apkSub`（apps/games）与数据 `category`（app/game）
单复数不一致导致列表恒空；列表搜索框只写 `data-keep` 未接 `data-live`，输入不过滤。
后者随搜索迁入子页一并解决（子页输入即 `data-live` 重渲染，焦点/光标由 render 保持）。

### 第八轮（2026-09-25，「我的」分组标题胶囊化）

问题：「我的」页各分组、卡片间未留合理间隙，分组不明显，卡片软阴影被吸顶标题覆盖。根因有三：
`.section-title` 组前仅 14px、与「标题→卡片」间距雷同（节奏丢失）；吸顶玻璃条满宽 + 负 margin
（`margin: 0 -4px`）呈横带形态，不像分组标题；吸顶时 `top: -8px` 顶死滚动区上沿，玻璃条整带
压住滑过的卡片与其彩色软阴影。

定案（`.section-title` 全局组件，mine/about/account/models/tts/apk 详情共用）：

1. **组前留白 26px**（`margin-top: 26px`），明显大于「标题→卡片」的 16px，分组节奏成立；
   页首首个标题上方无卡片，收敛为 14px（`.content > .section-title:first-child`）。
2. **玻璃底收缩为文字宽胶囊**（`width: fit-content` + 999px 圆角 + 1px 玻璃描边），
   吸顶时不再整带覆盖——卡片软阴影只在胶囊下小区域被遮，左右两侧完整可见；
   长标题（如「我的模型 · N 个」）`max-width: 100%` + 省略号截断。
3. **吸顶悬浮 `top: 6px`**（原 -8px），胶囊与滚动区上沿留缝，不再顶死。
4. 标题文字收紧为 13px / 700 / 字距 .3px（原 14px/600），✦ 前缀保留；加入主题过渡列表。

App 侧同步：仅 `MineScreen.kt` 的 `SectionTitle`（Compose 里唯一对应 `.section-title` 的吸顶文字标题）；
`ApkScreen.SectionHeader`（标题+查看全部）与 `ModelHubScreen` 分类 Tab 行为满宽吸顶条，保持原样。

**hero 问候语文案（同日追加）**：未登录时 hero 标题从固定「你好呀，游客！」改为**按一天时段随机问候**
（`HERO_GREETINGS`：午夜 0-4 / 黎明 4-6 / 早上 6-11 / 中午 11-13 / 下午 13-18 / 傍晚 18-20 / 晚上 20-24，
每时段 3 句随机）；第三行从固定「今天也要元气满满地折腾哦」改为 5 句随机池（`HERO_SUBS`，登录/未登录同池）；
登录时标题保持「用户名，欢迎回来！」。同一小时内复用已抽中句子（`S.x.heroCopy` 按小时缓存），
避免每次 render 文案闪变；`heroCopyFor(hour)` 可按小时直调走查各时段。

### 第七轮（2026-09-25，MoeApk 二次元风格全面改版）

原型从 Material 3 原生观感全面转为**二次元「MoeApk」主题**，色彩全部取自吉祥物安卓娘设定图：樱粉（蝴蝶结）/ 抹茶绿（裙）/ 天空蓝（鞋）/ 紫藤（点缀）。

**表现语言**：

1. **背景**：多层柔光 mesh 渐变（浅色=樱粉/薄荷/天蓝/奶油光斑；暗色=紫夜极光），内容滚动其上。
2. **玻璃质感**：卡片半透明 + 1px 亮色描边 + 彩色软阴影；`backdrop-filter` 模糊**只用于 chrome 层**（顶栏/底栏/抽屉/对话框/悬浮条/吸顶标题），列表卡片不模糊（性能预算）。
3. **发光**：主按钮/选中 chip/导航选中/开关/进度条/角标使用樱粉渐变 + 小面积彩色光晕（`--glow-primary`/`--glow-soft` 令牌）。
4. **渐变文字**：顶栏标题、`.headline`、`.sec-title` 用粉→紫渐变文字；`.section-title`（吸顶）为保持可读性用纯色 + ✦ 前缀。
5. **吉祥物**：统一为 Grok Bot 大头风（黑色胶囊眼 / 无嘴鼻 / 椭圆腮红 / 微歪头 / 色块无描边），两种姿态差分 × 明暗两版共 4 张透明素材（合计约 108KB）：日常问候（我的页横幅 + LLM 对话 AI 消息小头像）、眯眯笑眼迎宾（登录页）；**暗色一律换靛紫睡帽 + 睡衣领口版**，HTML 双 `<img>` + CSS `d-only`/`n-only` 工具类按主题切换。素材由设定图经 Qwen-Image 2.1（RGBA 模板）重绘生成，**制作手册（来源/风格规范/生成流程/提示词模板）见 [mascot-assets.md](mascot-assets.md)**。
6. **暗色差异化**：暗色「星夜」不只是反白——更深的紫夜底色、更亮的发光、独立的睡帽版吉祥物。
7. **点缀动画**：hero 区 2-3 颗 ✦ 闪烁（transform/opacity）、登录页大头浮动；`prefers-reduced-motion` 全部停用。
8. **设计令牌**：沿用旧令牌名（`--surface-*`/`--primary` 等）改值，新增 `--grad-*`（渐变）、`--glass-*`（玻璃）、`--glow-*`（发光）、`--bg-mesh`（背景）四组；`avatar()` 改为经 `--ah` 传色相由 CSS 生成渐变。

**App 同步要点**：Compose 侧对应 = Theme.kt 换种子/角色（樱粉 #E94E8A 系）+ 卡片/顶栏/底栏的半透明与描边 + 小面积 shadow 光晕；吉祥物素材与明暗切换逻辑可直接复用 assets/chara-*.webp（暗色一律换 `-night` 版）。动态取色开启时以系统色为准，本主题为 fallback。

### 第六轮（2026-09-24，软键盘避让修正）

LLM 对话输入框聚焦时弹出模拟键盘面板（仅原型演示用），定案形态 = **输入区紧贴键盘上沿，两者之间只有 composer 自身 padding、零多余空白**；对话列表同步收缩不遮挡。底部避让收敛为全局唯一一处：底部 padding 取 `max(导航高, IME 高)`，全键盘时内容止于键盘上沿、迷你/悬浮键盘时贴导航栏上沿；页内不再各自避让。LLM composer 增加输入区提示行（互斥单行）：未选模型 → 引导选模型；模型加载中 → 「模型加载中…」；已就绪无视觉 → 不支持附件；输入框 min-height 56px。

### 第四轮（真机反馈修正，2026-09-19）

1. **下载状态机**：退后台下载**继续**（进程存活即下载不暂停），回前台进度无缝衔接、**进度只增不减**；校验是下载走满后的独立阶段（进度条保留，不再出现"清零重下"）；失败重试默认**断点续传**（仅校验失败从头重下）；状态行带实时速度。原型用下载页「[debug] 模拟切后台 3 秒」验证后台推进。
2. **模型中心重设计**：分类 Tab（全部/对话/生图/语音/放大/点云）+ 每个模型带**用途标签**（对话/生图/语音/放大/点云）与**格式标签**（GGUF/ONNX/MNN/DLC/ZIP…）+ 就地过滤框（输入即过滤我的模型与推荐模型）+ 排序（时间/大小/名称）；「找模型」改为带关键词+来源直达搜索页的明确卡片。
3. **素材网格去文字**：网格视图不再叠任何名称/类型文字（此前图与字互相遮挡）；类型改用左上角小角标图标区分，视频时长保留角标。**点云素材保存预览图**（生成时产出原图 1/4 缩放缩略图），网格优先显示预览图；无预览图显示中性占位符。

### 素材查看器（沉浸式全屏）

素材查看器（asset 子页）为**无顶栏全屏界面**：`registerScreen` 的 `full: true` 选项不渲染 TopAppBar（Compose 侧对应全屏 Dialog / immersive viewer），返回用左上角悬浮键（Esc / 安卓返回键同样生效），顶部悬浮序号，底部按类型变化的工具栏；全屏时 proto-bar 调试条自动隐藏。

### 横屏 / 平板适配（App 侧对应 WindowSizeClass + NavigationSuiteScaffold + ListDetailPaneScaffold）

断点以 `.phone` 容器宽为准（CSS 容器查询 + JS `isRail()/isWide()` 同阈值，真机旋转/窗口变化自动重渲染）：

| 容器宽 | 形态 | 布局 |
|---|---|---|
| <720 | 竖屏手机 | 现状：NavigationBar 底栏、单列、历史用 overlay 抽屉 |
| ≥720 | 横屏手机 / 小平板 | 底栏变 **NavigationRail 左栏**（84px），内容右移；其余同竖屏 |
| ≥920 | 平板横屏 / 桌面全屏 | Rail + **双栏 master-detail** + 多列网格 |

≥920 具体规则：
- **LLM 对话 / 图片生成 / 语音生成**：会话列表 / 生成历史 / 合成历史常驻左栏（300px，含搜索、新建、设置入口），右栏对话区与输入区；输入区限宽 640 居中。窄屏的 overlay 抽屉保留（同一 `drawerListHtml/diffHistHtml/ttsHistHtml` 主体复用）。
- **APK 首页与应用/游戏/开源列表**：卡片两列（`.two-col`，`sectionColumn` 统一包装）。
- **AI 枢纽**：任务队列全宽，四个入口 2×2（`.ai-grid`）。
- **素材**：网格 `auto-fill minmax(150px,1fr)` 自适应列数；排序/视图工具行不变。
- 未改动的页（我的/下载/关于等）：Rail 下自然右移，维持单列阅读宽度。

### 第三轮（功能/交互补全，F1–F14 + I1–I8）

- **F1** 应用/游戏/开源列表带搜索框（名称/简介/标签）+ 标签筛选 chips；收藏条目置顶。
- **F2** 首页更新卡多应用感知（"发现 N 个应用可更新：A、B 等"）；更新检测页多更新时加"全部更新"（逐个错峰启动）。
- **F3** 下载完成 → "安装"（模拟调起系统安装器）；含 OBB 数据包的条目在详情页与任务卡给出放置说明。
- **F4** 应用/开源详情页右上角 ♡ 收藏；「我的 → 我的收藏」集中查看（空态导流）。
- **F5** 素材页排序（时间/名称）+ 网格/列表视图切换。
- **F6** 素材长按（500ms）或工具键进入多选，支持批量导入/批量删除。
- **F7** 素材查看器各类型工具栏加"详情"（尺寸/大小/路径/来源元信息面板）。
- **F8** LLM 对话：AI 末条 → 复制 / 重新生成；用户末条 → 编辑并重新发送（回填输入框）。
- **F9** 生图支持负向提示词（可折叠）与批量张数（×1/×2/×4，种子递增），历史记录可见负向词。
- **F10** 生图/合成记录抽屉内可搜索；AI 存素材的条目带来源标记，详情面板显示。
- **F11** 模型中心存储占用卡（总量/进度/清理未使用模型，撤销可用），模型列表按时间/大小排序。
- **F12** TTS 输入区实时字数与预计时长（按 4.2 字/秒估算）。
- **F13** 下载页"仅 Wi-Fi 下载"开关 + [debug] 模拟 Wi-Fi/蜂窝切换：蜂窝下自动暂停、回 Wi-Fi 自动恢复。
- **F14** 「我的」下载分区显示各节点延迟与可达状态（绿<100ms / 黄 / 红不可达）。
- **I1** 各 Tab 首次进入显示一次性轻引导横幅，点"知道了"或切走消失。
- **I2** 删除分级：轻删（下载任务/素材/生成记录/合成记录/收藏取消）→ toast + 撤销按钮；
  重删（模型文件）→ 保留二次确认弹窗；批量清理模型仍弹窗但完成后给撤销。
- **I3** 长列表滚动 >480px 出现回顶 FAB；分区标题吸顶。
- **I4** 模型搜索中转态为骨架屏（筛选器原地保留，不再整页闪白）。
- **I5** 下载页/AI 队列空态加"去逛逛"导流按钮。
- **I6** 素材查看器支持左右滑动切换（touch swipe）。
- **I7** 输入框聚焦自动滚入视野（软键盘场景兜底）。
- **I8** 明/暗主题切换带 0.22s 颜色过渡动画。
- 新增子页 `favorites`（我的收藏），已登记进对照表。

### 第二轮（布局/文案修正）

1. LLM 长文本消息换行问题（msg 白空间 pre-wrap）、发送键被挤压。
2. AI 抽屉标题文案统一为"对话历史 / 生成历史 / 合成记录"。
3. 关于页授权协议展开箭头方向反转（expand_less）。
4. 壁纸设置项行内展开改为独立对话框。
5. 素材网格外边距与查看器返回键布局修正。

### 第一轮（结构调整）

#### 导航

1. 底部导航四 Tab：**APK / 素材 / AI / 我的**。原"下载"Tab 并入"我的 → 下载任务"（downloads 子页）。

#### 素材

2. **素材 Tab**：网格列表，首格"导入素材"（模拟系统文件选择器）。素材类型：图片 / 视频 / 音频 / **3D 点云**（点云是图片的处理产物，作为一等素材）。
3. **素材查看器**（相册式，asset 子页）：左右切换浏览（序号含类型标签）、按类型变化的底部工具栏：
   - 图片：设为壁纸 / 分享 / AI 放大 / AI 扩图 / 3D 点云处理
   - 视频：设为壁纸（视频壁纸对话框）/ 分享 / 删除
   - 音频：波形舞台 + 播放，分享 / 删除
   - 点云：点云舞台 + 设为壁纸 / 分享 / 控制面板 / 删除
4. **耗时处理**在工具栏上方出现进度条：步骤、百分比、取消。完成去向：放大→存相册；扩图→存为新图片素材；
   **点云→存为点云素材并直接切到结果查看**。
5. **点云查看**：姿态感应（俯仰/左右倾斜滑杆演示 + 自动摇摆模拟陀螺仪）、查看方式（强度/缩放）、
   渲染性能（点云精度=渲染点数百分比）；控制面板**默认收起**，点舞台右上角齿轮展开。

#### AI

6. **AI Tab 为入口枢纽**：AI 任务队列 + 模型管理 / LLM 对话 / 图片生成 / 语音生成 四个独立入口条目，
   各自进入独立子页。AI 放大不再单列（在素材查看器对图片操作）。
7. **AI 任务队列**（ai-queue 子页）：所有 `mock.startJob` 的任务自动入队，运行中显示步骤+进度+取消，
   已完成可单个清除或清空；文件下载仍在"我的 → 下载任务"。
8. **LLM 对话**（llm 子页，Agent 化，经典助手布局）：
   - 主区域为对话区；进入即**新对话界面**（空态提示），首条消息自动建会话（标题取首条消息摘要）、
     按所选模型下载/加载，就绪后自动回复。
   - 底部输入区：**模型选择**（chip 点开对话框，新对话态选 modelSel；空会话直接换模型；
     有消息的会话换模型则另起新对话）+ **上下文用量**（token 数/上限 + 占用条，超 80% 变红，
     与模型 chip 同行内联）+ 图片附件 + 输入框（单行 56px 起步，App 端多行长高至 180dp 后
     内部滚动）+ 发送/停止（等宽 48px 键，生成中替换）。
   - 输入区下方**提示行**（互斥单行）：未选模型 → 引导选模型；会话已建但模型未就绪 →
     「模型加载中…」（首条消息发出后模型才在队列任务里加载，大模型可能数分钟，此时
     「先发送一条消息」已是过时建议）；已就绪无视觉能力 → 不支持附件；新对话未发过
     消息 → 发送后可知。
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

- 动态取色不可还原，统一用 fallback 主题「MoeApk」（樱粉 #E94E8A 系，见第七轮）。
- 开源条目图标用首字占位图（原型离线，不请求网络图标）。
- 下拉刷新为"点击模拟"链接；点云预览用 CSS 粒子舞台代替 GL 渲染。
- AI 对话/生图/语音结果均为模拟数据，用于验证布局与流程，不验证模型效果。
