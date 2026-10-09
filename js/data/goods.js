// 宅物（二次元周边策展）演示数据
// 真实管线（2026-10 定案）：muka.cool 后台宅物模块直连淘宝联盟 API 取数 →
// AI 加工（多模态筛图选封面 / 标题提炼 / 展厅映射 / 真实价核实；模型为内网部署，不随原型公开）→
// 输出 JSON feed 供 MoeApk App 调用。本文件为同数据结构的演示快照。
//
// 字段约定：
//   title  提炼后的展品名（真实环境由 AI 从淘宝原始标题提炼，10~15 字）
//   origin 淘宝原始标题（关键词堆砌原貌，详情页折叠展示，作透明度对照）
//   note   陈列备注 / 策展短评（AI 生成 + 人工抽查，抽查可关）
//   price  真实价（非引流最低价）；list 为淘宝划线价（可无）——feed 契约均为字符串，渲染端须兼容
//   days   收录天数；tpwd 为预生成淘口令（真实环境由服务端 taobao.tbk.tpwd.create 预生成）
//   图片一律 emoji + 色相（hue）渐变占位——原型不内嵌任何外部图片。
window.DB = window.DB || {};

// 展厅（分类）：俏皮主名 name + 标准词副名 sub + 策展语 blurb
window.DB.GOODS_CATS = [
  { id: 'badge',   name: '小铁片',   sub: '吧唧 · 马口铁徽章',    emoji: '📛', blurb: '别在包上的小心思，一枚一个心情。' },
  { id: 'acrylic', name: '塑料片',   sub: '亚克力立牌 · 挂件',    emoji: '🪧', blurb: '透明的最耐看，光从背后过来的时候。' },
  { id: 'figure',  name: '塑料小人', sub: '完成品手办',           emoji: '🎎', blurb: '摆在那里，就是一种陪伴。' },
  { id: 'plamo',   name: '拼装地狱', sub: '拼装模型',             emoji: '🔧', blurb: '地狱不难，难的是做完还想再做。' },
  { id: 'action',  name: '关节会动', sub: '可动人偶 · 粘土人',    emoji: '🪆', blurb: '能摆姿势的，都好玩。' },
  { id: 'plush',   name: '棉花坨坨', sub: '充棉玩偶 · 毛绒',      emoji: '🧸', blurb: '软的，揉起来解压。' },
  { id: 'paper',   name: '纸片们',   sub: '色纸 · 明信片 · 海报', emoji: '🎴', blurb: '薄薄一片，是某次心动的存档。' },
  { id: 'sticker', name: '贴纸胶带', sub: '贴纸 · 和纸胶带',      emoji: '🏷️', blurb: '贴满一切平面的冲动，从这里开始。' },
  { id: 'daki',    name: '等身抱枕', sub: '抱枕 · 枕套',          emoji: '🛋️', blurb: '抱着睡和靠着刷手机，都归它管。' },
  { id: 'wear',    name: '穿上身',   sub: '日常服饰 · T恤卫衣',   emoji: '👕', blurb: '低调到只有同好能认出来的那种。' },
  { id: 'cos',     name: '变身装备', sub: 'Cos服 · 假发 · 道具',  emoji: '🎭', blurb: '穿上就成为另一个人。' },
  { id: 'desk',    name: '桌面武装', sub: '键帽 · 鼠标垫 · 外设', emoji: '⌨️', blurb: '每天八小时面对的地方，值得武装。' },
  { id: 'life',    name: '生活渗透', sub: '杯壶 · 雨伞 · 杂货',   emoji: '🥤', blurb: '二次元渗透进喝水和出门。' },
  { id: 'ita',     name: '痛文化',   sub: '痛包 · 展示 · 装饰',   emoji: '👜', blurb: '把喜欢挂在身上，理直气壮。' }
];

// App 首页布局（对应 feed 的 home 对象；后台「展厅与首页」动态配置，此处为默认快照）：
//   hero        首页大标题
//   fresh_count 新入荷横滑条件数（0 = 隐藏该区块）
//   mosaic      展厅墙槽位（顺序=显示顺序；span 为 6 列网格跨列数，height 卡片像素高）
// 「换一批」不打乱布局，只在每个槽位的展厅内重抽封面展品。
window.DB.GOODS_HOME = {
  hero: '看看有什么好东西',
  fresh_count: 8,
  mosaic: [
    { hall: 'badge',   span: 4, height: 148 }, { hall: 'acrylic', span: 2, height: 148 },
    { hall: 'figure',  span: 2, height: 112 }, { hall: 'plamo',   span: 2, height: 124 },
    { hall: 'action',  span: 2, height: 112 }, { hall: 'plush',   span: 3, height: 136 },
    { hall: 'paper',   span: 3, height: 136 }, { hall: 'sticker', span: 2, height: 128 },
    { hall: 'daki',    span: 4, height: 128 }, { hall: 'wear',    span: 3, height: 120 },
    { hall: 'cos',     span: 3, height: 132 }, { hall: 'desk',    span: 2, height: 108 },
    { hall: 'life',    span: 2, height: 120 }, { hall: 'ita',     span: 2, height: 108 }
  ]
};

window.DB.GOODS = [
  // ---------- 小铁片 ----------
  { id: 'g01', cat: 'badge', title: '「星轨巡旅」镭射吧唧六枚组', price: 25.9, list: 32, emoji: '✨', hue: 290, days: 2,
    note: '镭射底在光下会慢慢转色，别在帆布包肩带上正好。这家的边缘打磨得干净，不割手。',
    origin: '【正版授权】星轨巡旅吧唧徽章二次元周边谷子马口铁胸针58mm镭射闪底吧唧套装动漫挂件生日礼物送女友闺蜜',
    attrs: ['马口铁', '58mm', '6 枚装', '镭射闪底'], tpwd: '￥Xk72QpLm91￥' },
  { id: 'g02', cat: 'badge', title: '猫耳女仆·闪底吧唧', price: 15.8, emoji: '🐱', hue: 340, days: 5,
    note: '细闪底不浮夸，女仆猫的表情画得很欠揍（褒义）。单枚包邮，凑包友好。',
    origin: '二次元猫耳女仆吧唧徽章动漫周边谷子闪底马口铁胸针学生书包挂件装饰可爱萌系生日礼物',
    attrs: ['马口铁', '58mm', '单枚'], tpwd: '￥Ab39TzWq20￥' },
  { id: 'g03', cat: 'badge', title: '「深海邮局」烫金徽章', price: 19.9, emoji: '📮', hue: 210, days: 9,
    note: '烫金线条在深色底上很出效果，别在牛仔外套上比别包上更合适。',
    origin: '深海邮局烫金徽章原创二次元周边金属质感胸针文艺复古挂件配饰学生礼物',
    attrs: ['马口铁', '烫金工艺', '44mm'], tpwd: '￥Qw81LmZx55￥' },
  { id: 'g04', cat: 'badge', title: '像素勇者·迷你吧唧四枚套', price: 22, emoji: '👾', hue: 120, days: 12,
    note: '32mm 小尺寸，一串别在笔袋拉链上刚好。像素风印得很锐利，没有糊边。',
    origin: '像素风勇者吧唧迷你徽章套装二次元游戏周边谷子胸针挂件复古游戏玩家礼物',
    attrs: ['马口铁', '32mm', '4 枚装'], tpwd: '￥Mn54KpWq83￥' },

  // ---------- 塑料片 ----------
  { id: 'g05', cat: 'acrylic', title: '「放学后的天文部」立牌', price: 32, emoji: '🔭', hue: 250, days: 1,
    note: '彩窗式印刷，逆光摆在窗台上效果最好。底座咬合紧，不会松松垮垮。',
    origin: '放学后的天文部亚克力立牌二次元动漫周边原创谷子桌面摆件学生生日礼物收藏',
    attrs: ['亚克力', '15cm', '含底座'], tpwd: '￥Zx20VbNm47￥' },
  { id: 'g06', cat: 'acrylic', title: '女仆猫·双插立牌', price: 45, emoji: '🐾', hue: 330, days: 4,
    note: '前后双插设计，景深比一般立牌强。印刷在夹层里，指甲刮不到图。',
    origin: '猫耳女仆亚克力立牌双插二次元周边谷子桌面摆件可爱萌系生日礼物送女友',
    attrs: ['亚克力', '双插', '18cm'], tpwd: '￥Pl66FdSa10￥' },
  { id: 'g07', cat: 'acrylic', title: '透明怪兽·彩窗挂件', price: 28, emoji: '👻', hue: 160, days: 7,
    note: '整块透明渐变，挂钥匙上像一小片彩色玻璃。附两种挂链，自己换着用。',
    origin: '透明怪兽亚克力挂件彩窗渐变二次元周边钥匙扣包包挂饰可爱创意礼物',
    attrs: ['亚克力', '8cm', '双挂链'], tpwd: '￥Hg93KpQw28￥' },

  // ---------- 塑料小人 ----------
  { id: 'g08', cat: 'figure', title: '「庭院深深」1/7 完成品手办', price: 299, list: 358, emoji: '🎍', hue: 140, days: 3,
    note: '这个价位里少见的场景底座，苔藓和石灯都有细节。裙摆渐变涂装没翻车。',
    origin: '庭院深深1/7手办完成品二次元动漫周边模型摆件生日礼物收藏级正版授权',
    attrs: ['PVC 完成品', '1/7', '约 24cm'], tpwd: '￥Cv55NbMz74￥' },
  { id: 'g09', cat: 'figure', title: 'Q版魔王·盒蛋随机款', price: 59, emoji: '😈', hue: 270, days: 6,
    note: '全 6 款随机，隐藏款是魔王打瞌睡。盒蛋的乐趣就是赌，量力而行。',
    origin: 'Q版魔王盒蛋盲盒手办二次元动漫周边桌面摆件随机款生日礼物',
    attrs: ['PVC', '约 8cm', '随机款'], tpwd: '￥Ty17WxQb66￥' },
  { id: 'g10', cat: 'figure', title: '「自习室」坐姿手办', price: 199, emoji: '📖', hue: 230, days: 15,
    note: '坐姿款的好处是可以摆在书架层板边上，脚垂下来。书本道具印了真的字。',
    origin: '自习室坐姿手办完成品二次元动漫周边模型摆件桌面装饰生日礼物',
    attrs: ['PVC 完成品', '约 14cm'], tpwd: '￥Uj88QaWs31￥' },

  // ---------- 拼装地狱 ----------
  { id: 'g11', cat: 'plamo', title: '机甲少女·1/144 拼装模型', price: 89, emoji: '🤖', hue: 200, days: 8,
    note: '分色做得厚道，素组效果就很完整。水口位置友好，新手可以拿来练手。',
    origin: '机甲少女拼装模型1/144可动手办二次元周边模型玩具生日礼物送男友',
    attrs: ['拼装模型', '1/144', '免胶'], tpwd: '￥Rf44GkLp90￥' },
  { id: 'g12', cat: 'plamo', title: '「废土旅人」拼装场景套装', price: 129, emoji: '🏜️', hue: 35, days: 11,
    note: '人偶加地台加一堆小道具，拼完就是一个完整场景。说明书步骤拆得很细。',
    origin: '废土旅人拼装模型场景套装二次元周边模型手办桌面摆件生日礼物',
    attrs: ['拼装模型', '含地台', '约 200 件'], tpwd: '￥Ws27EdRv52￥' },

  // ---------- 关节会动 ----------
  { id: 'g13', cat: 'action', title: '粘土人·书店店员', price: 319, emoji: '📚', hue: 45, days: 5,
    note: '三张替换脸加一摞小书配件，围裙的褶皱都捏出来了。粘土人就是贵得有道理。',
    origin: '粘土人书店店员可动手办Q版二次元周边正版模型摆件生日礼物收藏',
    attrs: ['可动', '约 10cm', '替换脸×3'], tpwd: '￥Nh60ZxCv18￥' },
  { id: 'g14', cat: 'action', title: '1/12 可动素体·武装少女', price: 99, emoji: '🗡️', hue: 355, days: 10,
    note: '素体关节紧实不松垮，武器包给得足。适合当改造和拍照的底子。',
    origin: '1/12可动素体武装少女机娘二次元周边可动手办模型桌面摆件生日礼物',
    attrs: ['可动', '1/12', '约 15cm'], tpwd: '￥Kp35QwEr77￥' },

  // ---------- 棉花坨坨 ----------
  { id: 'g15', cat: 'plush', title: '大橘猫团子·40cm', price: 69, emoji: '🍊', hue: 30, days: 2,
    note: '充棉量扎实，抱起来有分量感，不会越抱越塌。面料是短绒，不粘毛。',
    origin: '大橘猫玩偶毛绒玩具充棉抱枕二次元周边可爱猫咪公仔生日礼物送女友',
    attrs: ['短绒', '40cm', '可拆洗'], tpwd: '￥Gh12JkLz43￥' },
  { id: 'g16', cat: 'plush', title: '「深海章鱼」玩偶', price: 45, emoji: '🐙', hue: 280, days: 8,
    note: '翻面换表情的设计，一面笑眯眯一面气鼓鼓。触手里面有定型丝，可以凹造型。',
    origin: '深海章鱼翻面玩偶毛绒玩具二次元周边可爱公仔生日礼物送朋友',
    attrs: ['翻面设计', '30cm'], tpwd: '￥Bn79VbNm26￥' },
  { id: 'g17', cat: 'plush', title: '吐司猫·充棉挂件', price: 19.9, emoji: '🍞', hue: 40, days: 13,
    note: '巴掌大一片吐司，挂包上很惹眼。挂绳是硅胶的，比珠链结实。',
    origin: '吐司猫充棉挂件毛绒二次元周边钥匙扣包包挂饰可爱创意小礼品',
    attrs: ['充棉', '12cm', '硅胶挂绳'], tpwd: '￥Lq51MwNb88￥' },

  // ---------- 纸片们 ----------
  { id: 'g18', cat: 'paper', title: '「雨停信号」烫银色纸', price: 12, emoji: '🌈', hue: 175, days: 4,
    note: '烫银在暗处也会微微反光，夹进相框立书架上是标准摆法。边角压得很挺。',
    origin: '雨停信号烫银色纸二次元周边谷子收藏签名板明信片生日礼物',
    attrs: ['色纸', '烫银', '13.5×12cm'], tpwd: '￥Zs84XcVb19￥' },
  { id: 'g19', cat: 'paper', title: '夏日祭·海报三枚组', price: 35, emoji: '🎆', hue: 315, days: 9,
    note: '三枚可以横排拼成一整条夜市街景。用的是厚卡纸，直接蓝丁胶上墙不心疼。',
    origin: '夏日祭海报套装二次元周边动漫墙贴宿舍装饰生日礼物三枚组',
    attrs: ['厚卡纸', 'A3', '3 枚装'], tpwd: '￥Md26NaQw61￥' },

  // ---------- 贴纸胶带 ----------
  { id: 'g20', cat: 'sticker', title: '像素猫猫·防水贴纸40枚', price: 9.9, emoji: '🐱', hue: 150, days: 3,
    note: '防水覆膜实测贴水杯上洗过没事。40 枚不重复，贴行李箱进度飞快。',
    origin: '像素猫猫防水贴纸40枚二次元周边行李箱手机壳水杯贴纸可爱装饰',
    attrs: ['防水覆膜', '40 枚不重复'], tpwd: '￥Po98IkJu37￥' },
  { id: 'g21', cat: 'sticker', title: '昭和喫茶·和纸胶带', price: 16.5, emoji: '🍵', hue: 85, days: 7,
    note: '奶油苏打和布丁的循环柄，贴手帐边一级合适。粘性适中，撕下来不留胶。',
    origin: '昭和喫茶和纸胶带手帐贴纸二次元周边复古可爱装饰贴画学生礼物',
    attrs: ['和纸', '15mm×7m'], tpwd: '￥Yt73HgFd50￥' },

  // ---------- 等身抱枕 ----------
  { id: 'g22', cat: 'daki', title: '「月光茶会」等身抱枕套', price: 139, list: 169, emoji: '🌙', hue: 255, days: 6,
    note: '2WT 面料，滑但不起球，图是双面不同姿势。枕芯要另买，注意看尺寸。',
    origin: '月光茶会等身抱枕套二次元周边动漫双面枕套2WT面料生日礼物',
    attrs: ['2WT 面料', '160×50cm', '双面'], tpwd: '￥Ew45TzUi92￥' },
  { id: 'g23', cat: 'daki', title: '云朵鲨鱼·抱枕', price: 89, emoji: '🦈', hue: 195, days: 12,
    note: '软到可以当午睡枕，鲨鱼的表情很呆（褒义）。机洗一次没变形。',
    origin: '云朵鲨鱼抱枕毛绒玩具二次元周边可爱公仔午睡枕生日礼物送朋友',
    attrs: ['短绒', '60cm', '可机洗'], tpwd: '￥Ra69SdFg24￥' },

  // ---------- 穿上身 ----------
  { id: 'g24', cat: 'wear', title: '「电波系」oversize T恤', price: 79, emoji: '📡', hue: 215, days: 5,
    note: '图案只在后背，正面素色，日常穿完全不显眼。240g 面料，夏天单穿不透。',
    origin: '电波系oversize短袖T恤二次元周边动漫印花宽松男女同款夏季衣服',
    attrs: ['240g 棉', 'oversize', 'S~XXL'], tpwd: '￥Df31GhJk76￥' },
  { id: 'g25', cat: 'wear', title: '猫爪印花·连帽卫衣', price: 129, emoji: '🐾', hue: 335, days: 10,
    note: '袖口有猫爪刺绣，抬手才看得到——这种小心思比大印花高级。加绒款偏厚。',
    origin: '猫爪刺绣连帽卫衣加绒二次元周边可爱宽松男女秋冬外套生日礼物',
    attrs: ['加绒', '刺绣工艺', 'S~XL'], tpwd: '￥Hj57KlPz08￥' },

  // ---------- 变身装备 ----------
  { id: 'g26', cat: 'cos', title: '见习魔女·全套C服（含帽）', price: 259, emoji: '🧹', hue: 275, days: 14,
    note: '帽子内置定型丝，不会塌成饼。裙摆三层纱，转圈效果不错。尺码偏小一码。',
    origin: '见习魔女cosplay服装全套二次元动漫cos服女巫帽子漫展表演服现货',
    attrs: ['全套含帽', '涤纶', '尺码偏小'], tpwd: '￥Cx22VbNm63￥' },
  { id: 'g27', cat: 'cos', title: '和风狐面·手持道具', price: 35, emoji: '🦊', hue: 15, days: 6,
    note: '手绘风纹样，配浴衣或日常拍照都压得住。塑料材质但很轻，挂绳结实。',
    origin: '和风狐狸面具cos道具二次元动漫周边漫展拍照手持面具生日礼物',
    attrs: ['PVC', '手绘纹样', '含挂绳'], tpwd: '￥Qw86ErTy41￥' },

  // ---------- 桌面武装 ----------
  { id: 'g28', cat: 'desk', title: '「樱花神社」PBT 键帽套装', price: 129, emoji: '⛩️', hue: 345, days: 4,
    note: '五面热升华，樱花渐变没有色偏。注意是 OEM 高度，矮轴键盘别拍。',
    origin: '樱花神社PBT键帽热升华二次元机械键盘键帽全套个性定制OEM高度',
    attrs: ['PBT', '热升华', 'OEM 高度', '130 键'], tpwd: '￥Ui14OpAs59￥' },
  { id: 'g29', cat: 'desk', title: '云海·巨型鼠标垫 90×40', price: 49, emoji: '☁️', hue: 205, days: 7,
    note: '锁边整齐，铺在桌上像一片云。底面橡胶防滑力够，玻璃桌也稳。',
    origin: '云海超大鼠标垫二次元桌垫电竞游戏办公加厚锁边键盘垫90x40',
    attrs: ['90×40cm', '4mm 厚', '锁边'], tpwd: '￥Lz70XcVb35￥' },
  { id: 'g30', cat: 'desk', title: '猫耳耳机·蓝牙降噪', price: 169, emoji: '🎧', hue: 300, days: 9,
    note: '猫耳是软的，戴久了不压头。音质对得起价，灯效可以关掉（重要）。',
    origin: '猫耳蓝牙耳机头戴式降噪二次元周边可爱电竞游戏耳麦生日礼物送女友',
    attrs: ['蓝牙 5.3', '降噪', '灯效可关'], tpwd: '￥Nm48BvCx21￥' },

  // ---------- 生活渗透 ----------
  { id: 'g31', cat: 'life', title: '「岩浆」变色马克杯', price: 39, emoji: '🌋', hue: 12, days: 5,
    note: '倒热水后岩浆纹路会亮起来，冬天的快乐。杯壁厚，保温比一般马克杯好。',
    origin: '岩浆变色马克杯陶瓷二次元周边创意感温杯子生日礼物送男友女友',
    attrs: ['陶瓷', '感温变色', '350ml'], tpwd: '￥Vb93NmQw67￥' },
  { id: 'g32', cat: 'life', title: '星空印刷·透明长柄伞', price: 29, emoji: '☂️', hue: 240, days: 8,
    note: '伞面内侧印星空，抬头可见——雨天限定的浪漫。伞骨 8 根，抗风一般但够用。',
    origin: '星空透明雨伞长柄二次元周边创意网红雨伞学生生日礼物',
    attrs: ['8 骨', '伞下直径 96cm'], tpwd: '￥Ty65GhJk02￥' },

  // ---------- 痛文化 ----------
  { id: 'g33', cat: 'ita', title: '痛包·透明层双肩包', price: 109, emoji: '👜', hue: 320, days: 6,
    note: '透明层够深，吧唧立牌混摆不挤。自重轻，逛展一天肩膀不抗议。',
    origin: '痛包透明层双肩包二次元周边吧唧展示背包漫展谷子收纳包学生书包',
    attrs: ['透明展示层', '20L', '可立牌'], tpwd: '￥Sd29FgHj84￥' },
  { id: 'g34', cat: 'ita', title: '吧唧托·展示架三件套', price: 25, emoji: '🖼️', hue: 55, days: 11,
    note: '三种角度，58/75mm 吧唧都能立住。亚克力够厚，叠放收纳不占地。',
    origin: '吧唧托展示架二次元周边谷子徽章支架亚克力桌面展示架三件套',
    attrs: ['亚克力', '三件套', '58/75mm 通用'], tpwd: '￥Gh47JkLz16￥' }
];
