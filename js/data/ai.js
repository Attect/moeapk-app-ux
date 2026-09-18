// AI 目录数据快照（模型中心 / 各测试台用）
// 来源：website/mukaapp_moeapk/site_moeapk/ai/*.json（2026-09-18 时 195 条，此处取代表子集）
// kind: llm / diffusion / tts / tts-encoder / upscale / sharp；type: model / engine
window.DB = window.DB || {};
window.DB.SNAPSHOT_DATE = window.DB.SNAPSHOT_DATE || '2026-09-18';
window.DB.AI = [
  { "type": "engine", "id": "llm-fork", "name": "LLM 引擎（llama.cpp fork）", "kind": "llm", "version": "1.0.0",
    "summary": "端侧 LLM 推理引擎（llama.cpp fork，arm64）。",
    "parts": [ { "name": "llm-fork-arm64-v8a.zip", "size": 15728640 } ] },
  { "type": "model", "id": "bonsai-1-7b-q1", "name": "Bonsai 1.7B（Q1_0）", "kind": "llm", "version": "1.0.0",
    "summary": "PrismML Bonsai 1.7B Q1_0 量化 GGUF（llm-fork 引擎专用格式）", "engine": "llm-fork",
    "parts": [ { "name": "Bonsai-1.7B-Q1_0.gguf", "size": 248302272 } ] },
  { "type": "model", "id": "audio8-tts", "name": "Audio8 TTS 0.6B（INT4）", "kind": "tts", "version": "0.6b-preview-v3",
    "summary": "DualAR 多语言 TTS + 零样本语音克隆（Apache-2.0）；INT4 权重 + FP16 激活，CPU 可跑（异步合成），QNN NPU 二期实时", "engine": "onnxruntime",
    "parts": [
      { "name": "slow_ar_int4.onnx", "size": 900218 },
      { "name": "slow_ar_int4.onnx.data", "size": 290267090 },
      { "name": "fast_ar_int4.onnx", "size": 156318 },
      { "name": "fast_ar_int4.onnx.data", "size": 35055104 },
      { "name": "codec_decoder_fp16.onnx", "size": 208404480 }
    ] },
  { "type": "model", "id": "audio8-tts-encoder", "name": "Audio8 TTS 参考音频编码器（FP16）", "kind": "tts-encoder", "version": "0.6b-preview",
    "summary": "参考音频编码器：上传一段音频即可克隆音色。", "engine": "onnxruntime",
    "parts": [ { "name": "codec_encoder_fp16.onnx", "size": 845000000 } ] },
  { "type": "model", "id": "chillout-mix-qnn", "name": "Chillout Mix（SD1.5 QNN NPU）", "kind": "diffusion", "version": "1.0.0",
    "summary": "二次元插画模型 ChilloutMix，骁龙 8 Gen2 及以上 NPU 加速。", "engine": "sd-localdream",
    "parts": [ { "name": "ChilloutMix_qnn2.28_8gen2.zip", "size": 1150000000 } ] },
  { "type": "model", "id": "animagine-v4-sdxl", "name": "animagine v4（SDXL QNN NPU）", "kind": "diffusion", "version": "1.0.0",
    "summary": "高质量动漫 SDXL 模型，出图 1024×1024，骁龙 8 Gen3 及以上。", "engine": "sd-localdream",
    "parts": [ { "name": "animagine_v4_qnn2.28_8gen3.zip", "size": 2600000000 } ] },
  { "type": "model", "id": "upscale-anime-onnx", "name": "图片放大·动漫（Real-ESRGAN x4plus_anime_6B，CPU 兜底）", "kind": "upscale", "version": "1.0.0",
    "summary": "Real-ESRGAN 动漫插画 4 倍放大，约 18MB。", "engine": "onnxruntime",
    "parts": [ { "name": "upscaler.onnx", "size": 18874368 } ] },
  { "type": "model", "id": "upscale-real-qnn", "name": "图片放大·写实（4x_UltraSharpV2_Lite，QNN）", "kind": "upscale", "version": "1.0.0",
    "summary": "写实照片 4 倍放大，仅 QNN NPU 可用。", "engine": "qnn",
    "parts": [ { "name": "upscaler_qnn.zip", "size": 62914560 } ] },
  { "type": "engine", "id": "sharp-mnn", "name": "ML-Sharp 点云重建 MNN 引擎", "kind": "sharp", "version": "1.0.0",
    "summary": "把照片重建为可环视的三维点云场景（MNN/Vulkan，通用机型）。",
    "parts": [ { "name": "sharp-mnn-arm64-v8a.zip", "size": 890000000 } ] }
];
// 模型搜索结果用的演示仓库（模拟 ModelScope / HF 镜像 / HuggingFace 返回）
window.DB.MODEL_SEARCH_DEMO = [
  { "name": "mradermacher/Anime-Yuuki-7B-GGUF", "task": "对话 LLM", "author": "mradermacher", "source": "HF 镜像",
    "summary": "Anime Yuuki 7B 的 GGUF 量化合集，多种 quants。", "downloads": 4213, "likes": 156, "updated": "2026-09-02", "size": "4.1GB",
    "files": [ { "name": "Anime-Yuuki-7B-Q4_K_M.gguf", "size": 4360000000 }, { "name": "Anime-Yuuki-7B-Q2_K.gguf", "size": 3100000000 } ] },
  { "name": "succinctly/text2anime-xl", "task": "图像生成", "author": "succinctly", "source": "HuggingFace",
    "summary": "Anime-style SDXL fine-tune。", "downloads": 1205, "likes": 89, "updated": "2026-08-18", "size": "6.5GB",
    "files": [ { "name": "text2anime_xl.safetensors", "size": 6900000000 } ] },
  { "name": "ymp123/IndexTTS-2-GGUF", "task": "语音音频", "author": "ymp123", "source": "魔塔社区",
    "summary": "IndexTTS 2 的 GGUF 移植，支持零样本克隆。", "downloads": 880, "likes": 45, "updated": "2026-09-10", "size": "1.2GB",
    "files": [ { "name": "indextts-2-q4.gguf", "size": 1200000000 } ] },
  { "name": "Kijai/WanVideo_T2V_1.3B", "task": "视频生成", "author": "Kijai", "source": "HuggingFace",
    "summary": "轻量文生视频模型，适合端侧试验。", "downloads": 3320, "likes": 210, "updated": "2026-07-29", "size": "2.8GB", "gated": true,
    "files": [ { "name": "wan_t2v_1.3b_fp16.safetensors", "size": 2800000000 } ] }
];
