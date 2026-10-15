// 提示词库 / 标签补全 / 图片反推 演示数据（内嵌为 JS 全局变量，file:// 可用）
// 来源约定：提示词库对应 App 本地 JSON store；标签补全对应 Danbooru CSV（tag, 中文翻译列, 使用次数）；
// 图片反推对应 Florence-2 PromptGen（短句/详细）与 WD tagger（标签）三档返回。
window.DB = window.DB || {};

window.DB.PROMPTS = [
  { id: 'p1', cat: '人物', title: '通用女主角', fav: true, uses: 12,
    text: '1girl, solo, long hair, school uniform, cherry blossoms, soft light, upper body, looking at viewer' },
  { id: 'p2', cat: '人物', title: 'Q 版吉祥物', fav: false, uses: 8,
    text: 'chibi, android girl, pink twin-tails, big ribbon, green eyes, cheerful, simple background' },
  { id: 'p3', cat: '人物', title: '猫耳少女·近景', fav: true, uses: 6,
    text: '1girl, cat ears, silver hair, yellow eyes, hoodie, cozy room, warm lighting, detailed face' },
  { id: 'p4', cat: '场景', title: '雨后街道', fav: false, uses: 5,
    text: 'rainy street at night, neon signs, wet asphalt reflections, cinematic, depth of field' },
  { id: 'p5', cat: '场景', title: '黄昏教室', fav: false, uses: 4,
    text: 'empty classroom, sunset through windows, dust particles, wooden desks, nostalgic atmosphere' },
  { id: 'p6', cat: '场景', title: '樱花坡道', fav: true, uses: 9,
    text: 'cherry blossom slope, petals falling, blue sky with clouds, spring, wide shot, anime background art' },
  { id: 'p7', cat: '风格', title: '厚涂插画', fav: false, uses: 3,
    text: 'impasto, thick brush strokes, oil painting style, vivid colors, textured canvas' },
  { id: 'p8', cat: '风格', title: '赛璐璐·清爽', fav: false, uses: 7,
    text: 'cel shading, clean lineart, flat colors, bright and fresh, anime screencap style' },
  { id: 'p9', cat: '风格', title: '水彩柔光', fav: false, uses: 2,
    text: 'watercolor, soft pastel palette, gentle gradients, dreamy, delicate edges' },
  { id: 'p10', cat: '负面', title: '通用负面词', fav: true, uses: 20,
    text: 'lowres, bad anatomy, bad hands, missing fingers, extra fingers, blurry, jpeg artifacts, watermark, signature, text, cropped, worst quality' }
];

// 标签补全演示词库：{tag, cn, count}；排序规则：前缀命中 > 别名命中 > 包含命中，同级按 count 降序
window.DB.TAGS_DEMO = [
  { tag: '1girl', cn: '一个女孩', count: 9800000 }, { tag: 'solo', cn: '单人', count: 8900000 },
  { tag: 'long hair', cn: '长发', count: 5200000 }, { tag: 'looking at viewer', cn: '看向观众', count: 4700000 },
  { tag: 'blush', cn: '脸红', count: 4300000 }, { tag: 'smile', cn: '微笑', count: 4100000 },
  { tag: 'short hair', cn: '短发', count: 3900000 }, { tag: 'open mouth', cn: '张嘴', count: 3600000 },
  { tag: 'blue eyes', cn: '蓝眼', count: 3400000 }, { tag: 'twintails', cn: '双马尾', count: 3200000 },
  { tag: 'school uniform', cn: '校服', count: 2900000 }, { tag: 'cherry blossoms', cn: '樱花', count: 2700000 },
  { tag: 'serafuku', cn: '水手服', count: 2500000 }, { tag: 'hair ornament', cn: '发饰', count: 2400000 },
  { tag: 'sitting', cn: '坐姿', count: 2300000 }, { tag: 'standing', cn: '站姿', count: 2200000 },
  { tag: 'ahoge', cn: '呆毛', count: 2100000 }, { tag: 'cat ears', cn: '猫耳', count: 2000000 },
  { tag: 'green eyes', cn: '绿眼', count: 1900000 }, { tag: 'yellow eyes', cn: '黄眼', count: 1800000 },
  { tag: 'silver hair', cn: '银发', count: 1700000 }, { tag: 'pink hair', cn: '粉发', count: 1650000 },
  { tag: 'hood', cn: '兜帽', count: 1600000 }, { tag: 'hoodie', cn: '连帽衫', count: 1550000 },
  { tag: 'outdoors', cn: '户外', count: 1500000 }, { tag: 'sky', cn: '天空', count: 1450000 },
  { tag: 'cloud', cn: '云', count: 1400000 }, { tag: 'day', cn: '白天', count: 1350000 },
  { tag: 'night', cn: '夜晚', count: 1300000 }, { tag: 'rain', cn: '雨', count: 1250000 },
  { tag: 'umbrella', cn: '伞', count: 1200000 }, { tag: 'city', cn: '城市', count: 1150000 },
  { tag: 'street', cn: '街道', count: 1100000 }, { tag: 'neon lights', cn: '霓虹灯', count: 1050000 },
  { tag: 'reflection', cn: '倒影', count: 1000000 }, { tag: 'classroom', cn: '教室', count: 950000 },
  { tag: 'sunset', cn: '黄昏', count: 900000 }, { tag: 'window', cn: '窗', count: 850000 },
  { tag: 'depth of field', cn: '景深', count: 800000 }, { tag: 'bokeh', cn: '焦外虚化', count: 750000 },
  { tag: 'light particles', cn: '光斑粒子', count: 700000 }, { tag: 'warm lighting', cn: '暖光', count: 650000 },
  { tag: 'soft light', cn: '柔光', count: 600000 }, { tag: 'chibi', cn: 'Q版', count: 550000 },
  { tag: 'masterpiece', cn: '杰作', count: 500000 }, { tag: 'best quality', cn: '最高质量', count: 490000 },
  { tag: 'ultra-detailed', cn: '超精细', count: 480000 }, { tag: 'anime style', cn: '动漫风格', count: 470000 },
  { tag: 'cel shading', cn: '赛璐璐', count: 460000 }, { tag: 'watercolor', cn: '水彩', count: 450000 }
];

// 图片反推三档演示结果（对同一张示例图）：标签=WD tagger；短句/详细=Florence-2 PromptGen
window.DB.CAPTION_DEMO = {
  tags: '1girl, solo, long hair, pink hair, twin-tails, green eyes, android girl, big ribbon, chibi, cheerful, simple background, cherry blossoms, soft light',
  short: 'A chibi android girl with pink twin-tails and a big ribbon, smiling under cherry blossoms.',
  detailed: 'A cute chibi-style android girl with long pink twin-tails tied by a large ribbon, bright green eyes and a cheerful expression. She stands beneath blooming cherry trees with petals drifting in the soft afternoon light. The illustration uses clean cel shading, a pastel pink and mint palette, and a simple uncluttered background that keeps the focus on her face.'
};
