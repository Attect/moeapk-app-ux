// 应用目录数据快照
// 来源：website/mukaapp_moeapk/site_moeapk/apps/*.json（服务端 catalog.rs 编译期内嵌的同一份数据）
// 再提取：tools/extract-data.ps1
//
// DEMO_ITEMS：真实目录当前仅 moeapk-service 一条。为撑起首页"应用/游戏"分区的多条目体感，
// 附带了 2 条由 _example.json 模板派生的演示项（id 带 demo- 前缀）。设 false 可查看真实单条目状态。
window.DB = window.DB || {};
window.DB.SNAPSHOT_DATE = '2026-09-18';
window.DB.DEMO_ITEMS = true;
window.DB.CATALOG = [
  {
    "id": "moeapk-service",
    "title": "MoeApk 服务 App",
    "version": "0.9.5",
    "summary": "MoeApk 服务 App：MK 通行证子授权、数据下载、端侧 AI 推理（LLM/扩散/TTS）、模型中心、壁纸中心（静态/视差/3D 点云/视频动态壁纸）、更新检测。",
    "tags": ["工具", "AI", "服务"],
    "category": "app",
    "published_at": "2026-09-18",
    "package": "com.moeapk",
    "version_code": 26,
    "min_sdk": 31,
    "channel": "stable",
    "parts": [
      { "name": "moeapk-0.9.5.apk", "kind": "apk", "size": 5533343, "location": "b+node" }
    ],
    "install": { "type": "apk", "package": "com.moeapk", "notes": "直接安装 APK。需 Android 12+。" },
    "changelog": [
      { "version": "0.9.5", "version_code": 26, "notes": [
        "新增：3D 点云壁纸在没有专用 NPU 的机型上也能用（自动选择 GPU 或 CPU 方式重建，旗舰机型不变）",
        "优化：非旗舰机型的点云重建速度（GPU 方式比 CPU 方式快约 1.6 倍）",
        "优化：GPU 方式的模型体积更小（约 1.3GB，CPU 方式约 2.6GB）"] },
      { "version": "0.9.4", "version_code": 25, "notes": [
        "修复：3D 点云壁纸偶尔出现重影的问题",
        "修复：应用为壁纸后从系统预览返回时，点云预览画面变黑的问题",
        "新增：3D 点云壁纸支持视野调整（在点云预览页调整缩放与左右/上下位置，壁纸比例与屏幕不一致时可以重新取景）"] },
      { "version": "0.9.3", "version_code": 24, "notes": [
        "修复：3D 点云壁纸转动手机时画面扭曲变形的问题，转动更平稳",
        "新增：3D 点云壁纸支持平面平移模式（在点云预览页切换）",
        "优化：3D 点云壁纸默认全分辨率渲染，细笔画与文字更清晰（帧率略降，可在点云预览页「点云精度」调整）"] },
      { "version": "0.9.2", "version_code": 23, "notes": [
        "优化：3D 点云壁纸画质大幅提升——黑板粉笔字、屏幕上的架构图等细小内容现在清晰可读",
        "修复：3D 点云壁纸背景图与点云错位、画面缝隙的问题",
        "优化：3D 点云壁纸的镜头效果与官方演示对齐，转动视角更自然"] },
      { "version": "0.9.1", "version_code": 22, "notes": [
        "新增：3D 点云壁纸支持预览——设为壁纸前可先拖动画面、开关自动摇摆查看立体效果，满意后再应用",
        "修复：3D 点云壁纸画面左右压缩、上下颠倒、出现异常大光点的问题",
        "修复：3D 点云壁纸转动手机时立体感不足的问题"] },
      { "version": "0.9.0", "version_code": 21, "notes": [
        "新增：壁纸中心——照片可设为桌面、锁屏或同时设置，支持先 AI 放大再设置（动漫/写实两种模型，旗舰芯片自动使用 NPU 加速）",
        "新增：动态壁纸（视差）——壁纸随手机倾斜呈现立体纵深感，晃动强度可调",
        "新增：3D 点云壁纸（旗舰芯片）——把照片重建为可环视的三维场景，转动手机即可变换视角（骁龙 8 Gen 2 / 8 Gen 3 及以上，模型首次使用自动下载）",
        "新增：视频动态壁纸——选择 30 秒内的视频循环播放，可开关声音、调节亮度",
        "新增：壁纸库自动去重、按最近使用排序，常用壁纸一触即达",
        "修复：部分机型使用 NPU 放大图片后整体偏暗的问题",
        "优化：壁纸所需的深度/点云模型首次使用时自动下载，引擎包按需获取，不再占用安装包体积"] },
      { "version": "0.8.1", "version_code": 20, "notes": [
        "优化：APK 频道更省流量——切换页面不再重复加载内容，列表增加下拉刷新，可随时手动获取最新内容",
        "优化：首页仅在有应用更新时显示更新提示，平时不再占用空间",
        "优化：开源应用图标与标题对齐，图标加载完成前显示占位图，页面不再跳动",
        "优化：首页应用列表不再显示本 App 自身"] },
      { "version": "0.8.0", "version_code": 19, "notes": [
        "新增：APK 频道全新上线，首页汇总应用、游戏、开源三个板块的最新内容，更新检查也移到了这里",
        "新增：应用板块可浏览本站发布的应用，查看更新日志与安装说明，一键下载（自动走可用节点）",
        "新增：开源板块收录二次元相关开源应用与游戏，可查看各版本资产并直接下载，也可跳转开源平台发行页",
        "优化：MK 通行证账户入口移至“我的”页面，底部导航更精简"] }
    ]
  },
  {
    "id": "demo-kirara-diary",
    "demo": true,
    "title": "绮良良的配送日记",
    "version": "2.3.1",
    "summary": "演示条目：二次元风放置养成小游戏，扮演快递猫娘完成每日配送委托，收集手办与家具。含完整 OBB 数据包。",
    "tags": ["汉化", "重配音", "放置"],
    "category": "game",
    "published_at": "2026-09-10",
    "package": "com.demo.kirara",
    "version_code": 47,
    "min_sdk": 26,
    "channel": "stable",
    "parts": [
      { "name": "kirara-diary-2.3.1.apk", "kind": "apk", "size": 86422528, "location": "b+node" },
      { "name": "obb/main.78234.com.demo.kirara.obb", "kind": "obb", "size": 524288000, "location": "node" },
      { "name": "语音包-voice-zh.zip", "kind": "data", "size": 157286400, "location": "node" }
    ],
    "install": { "type": "apk_obb", "package": "com.demo.kirara", "notes": "先安装 APK，再把 OBB 推到 /sdcard/Android/obb/<包名>/ 下；语音包解压到游戏数据目录。" },
    "changelog": [
      { "version": "2.3.1", "version_code": 47, "notes": [
        "新增：秋季限定配送事件与两套家具",
        "修复：部分机型闪退的问题",
        "优化：启动速度"] },
      { "version": "2.3.0", "version_code": 46, "notes": [
        "新增：猫娘换装系统",
        "修复：配送委托偶发无法完成的问题"] }
    ]
  },
  {
    "id": "demo-nekomimi-player",
    "demo": true,
    "title": "猫耳播放器",
    "version": "1.8.0",
    "summary": "演示条目：本地音乐播放器，ACG 曲目信息刮削、歌词滚动、直播电台订阅。Material You 动态取色。",
    "tags": ["汉化"],
    "category": "app",
    "published_at": "2026-09-05",
    "package": "com.demo.nekomimi",
    "version_code": 108,
    "min_sdk": 28,
    "channel": "stable",
    "parts": [
      { "name": "nekomimi-player-1.8.0.apk", "kind": "apk", "size": 18874368, "location": "b+node" }
    ],
    "install": { "type": "apk", "package": "com.demo.nekomimi", "notes": "直接安装 APK。" },
    "changelog": [
      { "version": "1.8.0", "version_code": 108, "notes": [
        "新增：直播电台订阅",
        "优化：歌词滚动流畅度"] }
    ]
  }
];
// 演示更新：让"更新卡"有可点状态。真实逻辑由服务端 updates 接口驱动，这里快照一条。
window.DB.UPDATES = [
  { "id": "moeapk-service", "version": "0.9.6", "version_code": 27, "size": 5600000, "force": true,
    "notes": ["演示：修复若干问题", "演示：优化壁纸加载速度"] }
];
