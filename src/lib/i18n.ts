/**
 * The language layer.
 *
 * Deliberately tiny: two languages, one flat dictionary, no dependency — the
 * site already ships its own hash router, and a full i18n framework would cost
 * more than the problem is worth here.
 *
 * SCOPE (raised 2026-10-05, user: 「要保证网站国际化」):
 * Everything the interface *says* goes through this file. That includes the
 * experiment pages — panel labels, slider names, button captions, the palette
 * names, the error text. Left in Chinese they make the EN switch a lie: you
 * flip to English and the page is still mostly Chinese.
 *
 * What stays Chinese is the *content*, not the chrome: dev-log entries, the
 * collected-source credits, the long-form prose inside an experiment's own
 * title/lede. Those are records of where things came from and rewriting them
 * would be a translation, not a setting. They are marked inline.
 *
 * Practical rule for adding UI text: if a visitor can *operate* something
 * because of this string, it belongs in `zh`+`en` here. If it only *describes*
 * what a work is, it may stay in the data file.
 *
 * The choice is remembered in localStorage and mirrored onto `<html lang>` so
 * screen readers, hyphenation and `:lang()` selectors follow along.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type Lang = 'zh' | 'en';

const STORAGE_KEY = 'softlab:lang';

type Vars = Record<string, string | number>;

/* ---------- the dictionary ---------- */

const zh = {
  /* header */
  'brand.tag': '新交互收集箱',
  'nav.aria': '站点分区',
  'lang.switch': '切换语言',
  'lang.zh': '中文',
  'lang.en': 'English',

  /* theme */
  'theme.switch': '切换明暗',
  'theme.light': '始终浅色',
  'theme.dark': '始终深色',
  'theme.system': '跟随系统',

  /* hero */
  'hero.kicker.est': 'Est. 2026 · 一直在收',
  'hero.kicker.note': '没有一个是用图片做的',
  'hero.lede.a':
    '看到新奇的东西就收进来：会流动的、会撕裂的、会回弹的、会被撕开又拼回去的。每个都拆开看清楚它',
  'hero.lede.hi': '到底怎么做到的',
  'hero.lede.b': '，再做成能上手玩的页面。鼠标放上去，它们会让你知道自己是活的。',
  'hero.meta.since': '起于',
  'hero.meta.count': '{n} 个',
  'hero.meta.experiments': '实验',
  'hero.meta.buttons': '按钮动效',
  'hero.meta.status': '状态',
  'hero.meta.statusValue': '持续收集中',

  /* cards */
  'card.aria': '打开 {name}',
  'card.ariaMeta': '{name} · 跳到这一栏',

  /* panels */
  'exp.head.meta': '{n} 个 · 能上手玩',
  'btn.head.meta': '{n} 个 · 悬停 / 点击 / 松手',
  'btn.lede':
    '整套动效共用同一组时长与缓动曲线，所以放在一起手感是齐的。每个都能点开，看它到底怎么动、用了哪一档时间。下面这些是真的按钮 —— 直接上手。',
  'grow.head.meta': '这里的更新方式',
  'grow.step1.t': '丢进来',
  'grow.step1.d':
    '看到什么新鲜的就发过来——一个组件库、一个开源玩具、一段效果演示。链接或截图都行。',
  'grow.step2.t': '拆开看',
  'grow.step2.d':
    '弄清它到底怎么做到的：是 shader、是物理、还是障眼法。挑出最小、最能复用的那部分。',
  'grow.step3.t': '做成能玩的',
  'grow.step3.d':
    '写成独立实验放进列表，配上可调的参数面板。以后做别的东西时，随时能拿它当零件。',
  'grow.stat.exp': '个实验',
  'grow.stat.btn': '个按钮动效',
  'grow.stat.img': '张图片 / 全部实时计算',
  'grow.note':
    '这里没有一张贴图。你看到的每一个果冻、每一条波纹、每一次回弹，都是页面当场算出来的 —— 所以它们能被抓住、能被按下去、能在你松手之后自己回到原位。',
  'log.head.meta': '当前 {v} · {n} 个版本',
  'log.lede':
    '这个站还在长。每一次改动都记在下面，最新在最上面 —— 版本号最后一位每次改动都会加一。',
  'loading.experiment': '正在装载实验…',

  /* destroy panel */
  'destroy.head.meta': '一个可以拆掉的站',
  'destroy.lede':
    '别人做的游戏，我们把入口收在这儿：输入任意网址，那个页面会变成一张可以跳上去的地图 —— 剩下的交给你。',
  'destroy.step1.t': '输入网址',
  'destroy.step1.d': '任何网址都行 —— 它会被画成一张可以跳上去的地图，文字和图片都变成地形。',
  'destroy.step2.t': '拆掉它',
  'destroy.step2.d':
    '七个武器轮着换，手雷右键扔；顶上那条进度打满，这一局就结束。最多六个人能同时进来，一个人也行。',
  'destroy.step3.t': '碰不到真的东西',
  'destroy.step3.d':
    '它只是把网页画进自己的画布里，任何网站的数据都不会被动到。这是玩具，不是工具。',
  'destroy.start': '摧毁本网站',
  'destroy.other': '或者，去拆别的网站',

  /* footer */
  'foot.experiments': '{n} 个实验 · 持续更新',
  'foot.log': '开发日志 {v}',
  'foot.changelog': '更新记录 →',
  'foot.star': '★ 在 GitHub 上留个 star',
  'foot.credit': '灵感来自 soft-matter · canvas-ui · 全部效果实时计算',


  /* ---------- 云间列车：实验内所有可操作文案 ----------
     「可操作」的判据：访客会因为这句话去*操作*某样东西，就必须在词典里。
     只是*描述*这个作品是什么的（标题、来源、长文案）留在数据文件。 */
  'ct.title': '云间列车',
  'ct.lede': '十四层云海，一列火车，一座桥。',
  'ct.sub': '会开走的画面',
  'ct.custom': '自定义',
  'ct.export': '导出成 HTML',
  'ct.export.title': '把当前这套光导出成一个文件，双击就能看',
  'ct.back': '返回列表',
  'ct.stage': '落日云间列车',

  'ct.bar.note': '{name} · 一片云海，一列火车',
  'ct.hud.title.a': 'Cloud',
  'ct.hud.title.b': 'Train.',
  'ct.hud.sub': '十四层云海 · 悬索桥 · 蒸汽',
  'ct.hud.subEn': 'CLOUDS · BRIDGE · STEAM',

  'ct.panel.open': '光线面板',
  'ct.panel.title': '光线',
  'ct.panel.close': '收起面板',
  'ct.panel.gripClose': '收起光线面板',
  'ct.panel.gripOpen': '展开光线面板',
  'ct.panel.changed': '{name} 改',
  'ct.panel.edited': '已改',
  'ct.panel.preset': '预设',
  'ct.panel.tintedNote': '在下面「颜色」里改过了 —— 现在是{base}加你自己的调整。',
  'ct.panel.revert': '回到「{name}」',

  'ct.dock.restore': '全部复原',
  'ct.dock.restore.title': '所有设置回到刚打开时的样子：落日、默认速度、重放开场',
  'ct.dock.shuffle': '换束光',
  'ct.dock.shuffle.title': '只换颜色，不动速度与画面参数（避开同色系，明暗浓淡反向）',
  'ct.dock.pause': '暂停',
  'ct.dock.resume': '继续',
  'ct.dock.replay': '重播',
  'ct.dock.replay.title': '重放开场：云层重新揭示一次',
  'ct.dock.keep': '留在本机',
  'ct.dock.kept': '已留下',
  'ct.dock.keep.title': '把这套光留在这台设备上，下次打开还是它',
  'ct.err': '渲染失败：{msg}',
  'ct.err.webgl2': '需要 WebGL 2 支持（WebGL 2 is required）',

  'ct.group.frame': '画面',
  'ct.group.light': '光',
  'ct.group.tail': '收尾',
  'ct.group.colour': '颜色',
  'ct.group.colour.badge': '已改',
  'ct.more': '还有 {n} 项',
  'ct.less': '收起',

  'ct.tint.lightLabel': '光 · 换整幅画的调子',
  'ct.tint.objLabel': '物 · 只染一个部件',
  'ct.tint.sky': '天空',
  'ct.tint.sky.hint': '云都让开的地方',
  'ct.tint.train': '列车',
  'ct.tint.train.hint': '直选色 · 保留明暗',
  'ct.tint.smoke': '蒸汽',
  'ct.tint.smoke.hint': '相乘 · 白＝不变',
  'ct.tint.shadow': '暗部',
  'ct.tint.shadow.hint': '最暗处的光',
  'ct.tint.mid': '中间调',
  'ct.tint.mid.hint': '云海的主色',
  'ct.tint.high': '高光',
  'ct.tint.high.hint': '云顶与太阳',

  'ct.sl.speed': '行进速度',
  'ct.sl.zoom': '视角缩放',
  'ct.sl.offset': '垂直位置',
  'ct.sl.amplitude': '云层起伏',
  'ct.sl.detail': '噪声细节',
  'ct.sl.feedback': '拖影',
  'ct.sl.grade': '配色强度',
  'ct.sl.temperature': '冷暖色温',
  'ct.sl.exposure': '曝光亮度',
  'ct.sl.saturation': '色彩饱和度',
  'ct.sl.hue': '整体色相',
  'ct.sl.vignette': '暗角强度',
  'ct.sl.grain': '胶片颗粒',
  'ct.sl.resolution': '渲染比例',
  'ct.sl.introDuration': '开场时长',
  'ct.sl.introFeather': '开场羽化',

  /* ---------- 云间列车：配色预设 ----------
     「name」是名字不是说明：中文两字，英文 1-2 个词，像个名字。
     「note」是一句话，破折号在英文里换成逗号或分号。
     术语：暗部=Shadows 中间调=Midtones 高光=Highlights 云海=cloud sea。 */
  'fam.warm': '同色',
  'fam.warm.hint': '靠明度拉开，安静',
  'fam.cool': '冷调',
  'fam.cool.hint': '同上，冰的那一支',
  'fam.neutral': '素色',
  'fam.neutral.hint': '近乎无彩，靠浓淡',
  'fam.vivid': '浓艳',
  'fam.vivid.hint': '彩度很高但不撞色',
  'fam.duotone': '双拼',
  'fam.duotone.hint': '两支甜色靠明度差撑',
  'fam.clash': '撞色',
  'fam.clash.hint': '色相隔 100° 以上，画面会撕开',
  'fam.acid': '多巴胺',
  'fam.acid.hint': '荧光对撞，最吵',

  'pal.sunset.name': '落日',
  'pal.sunset.note': '原作的暖橙，低角度的太阳，云顶还烫着',
  'pal.ink.name': '水墨',
  'pal.ink.note': '把饱和度抽掉，只剩浓淡——云像宣纸上洇开的一笔',
  'pal.aurora.name': '极光',
  'pal.aurora.note': '冷绿打在云背上，高光是薄荷色的，边上发紫',
  'pal.dusk.name': '蓝调',
  'pal.dusk.note': '太阳已经走了，云只剩剪影，天空压得很低',
  'pal.sakura.name': '樱',
  'pal.sakura.note': '把暖橙整个换掉，云顶变成粉白，光是软的',
  'pal.solar.name': '正午',
  'pal.solar.note': '光从顶上压下来，几乎没有阴影——平，得有点硬',
  'pal.ember.name': '余烬',
  'pal.ember.note': '只留暗红和黑，像烧完以后还亮着的那块炭',
  'pal.neon.name': '霓虹',
  'pal.neon.note': '青洋红，高光过曝——把画面推成一块糖纸',

  'pal.acid-rose.name': '酸玫',
  'pal.acid-rose.note': '荧光黄绿撞上玫红 —— 暗部发酸、亮部发甜，中间是整片不稳定的绿',
  'pal.acid-violet.name': '酸紫',
  'pal.acid-violet.note': '毒绿对深紫，171° 正互补。这套是全部里最不客气的一套',
  'pal.ultramarine.name': '群青',
  'pal.ultramarine.note': '群青压金黄，179° 正互补。蓝到发紫，金亮到发白',
  'pal.red-cyan.name': '红青',
  'pal.red-cyan.note': '正红对青，174°。最老牌的撞色，稳到不会出错',
  'pal.pumpkin.name': '南瓜',
  'pal.pumpkin.note': '南瓜橙对松石绿，146°。暖与冷的正面交锋，不刺眼但很响',
  'pal.blue-lime.name': '蓝柠',
  'pal.blue-lime.note': '深蓝撞柠黄，155°。冷面暖芯，像夜色里一盏荧光灯',
  'pal.violet-yellow.name': '紫柠',
  'pal.violet-yellow.note': '紫对柠黄，152°。比「蓝柠」更暖一点，糖果味更重',
  'pal.mint-coral.name': '薄荷',
  'pal.mint-coral.note': '薄荷绿对珊瑚，161°。两支都甜，靠明度差撑开',
  'pal.teal-coral.name': '墨玫',
  'pal.teal-coral.note': '深青对玫瑰，177°。暗部压得极低，靠高光那一抹粉撑起整幅',
  'pal.electric.name': '电光',
  'pal.electric.note': '青对洋红，125°。赛博但克制 —— 中间调压暗才不会俗',
  'pal.fuchsia-lime.name': '洋红',
  'pal.fuchsia-lime.note': '品红对黄绿，129°。多巴胺配色里最吵的一套',
  'pal.sherbet.name': '冰沙',
  'pal.sherbet.note': '青柠对桃粉，153°。三支都亮，接近渐变 —— 唯一例外是暗部压深了',
  /* ---------- 云海族（低色相差 · 高明度差）---------- */
  'fam.sea': '云海',
  'fam.sea.hint': '同一色相，只换明暗',
  'pal.violetSea.name': '藕荷',
  'pal.violetSea.note': '天顶藕紫、云顶粉白、云海重紫 —— 同一色相家族靠明度拉开，色相只差三十度',
  'pal.snowRidge.name': '雪岭',
  'pal.snowRidge.note': '青灰的峰、白得发亮的脊线、深到发黑的谷 —— 最亮的一段刺眼',
  'pal.nightTide.name': '夜潮',
  'pal.nightTide.note': '深蓝的夜、紫的浪、一点冷白打在浪脊上 —— 云海在夜里涨潮',


/* ---------- 实验索引卡片 / wip 占位页 ---------- */
  'exp.notOpen': '还没开放',
  'exp.openAria': '打开实验',
  'exp.openGo': '打开实验 →',
  'exp.wipGo': '看看它在做什么 →',
  'wip.kicker': '这一只还没养顺手',
  'exp.wipFlag': '还没开放',
  'exp.thumbLabel': '{name} 的预览画面',

  /* ---------- 三个实验页共用的返回键 ---------- */
  'ui.back': '返回列表',
  'ui.elsewhere': '先看看别的',

  /* ---------- 01 软体物质：实验内文案 ---------- */
  'sm.bar.note': '按住就能捏 · 松手自己弹回来',
  'sm.stage.aria': '可拖拽的三维软体果冻',
  'sm.hud.sub': '拖拽塑形 · 松手回弹 · 双击弹跳',
  'sm.hud.subEn': 'TOUCH · STRETCH · RELEASE',
  'sm.panel.open': '材料面板',
  'sm.panel.aria': '软体参数',
  'sm.panel.sub': '01 / 软体',
  'sm.panel.close': '收起面板',
  'sm.hint': '按住表面往下压 · 抓住边缘可以掀起',
  'sm.bounce': '弹一下',
  'sm.pause': '暂停',
  'sm.resume': '继续',
  'sm.slow': '慢动作',
  'sm.normal': '常速',
  'sm.slow.title': '慢动作：把时间放慢到 0.22×，方便看清落地时的形变',
  'sm.field.shape': '形状',
  'sm.field.colour': '颜色',
  'sm.field.elasticity': '弹性',
  'sm.field.damping': '阻尼',
  'sm.field.glass': '通透度',
  'sm.field.spin': '环境旋转',
  'sm.field.shapeColour': '这个形状自带配色，通透度调低才显色',
  'sm.custom': '自定义',
  'sm.custom.title': '自己调一个颜色',
  'sm.random': '随机一个',
  'sm.reset': '重置',
  'sm.shape.ghost': '青柠果冻精灵',
  'sm.shape.watermelon': '西瓜果冻',
  'sm.shape.bear': '小熊果冻',
  'sm.shape.star': '星星果冻',
  'sm.shape.orb': '球',
  'sm.shape.cube': '方糖',
  'sm.paint.0': '西瓜红',
  'sm.paint.1': '翡翠',
  'sm.paint.2': '琥珀',
  'sm.paint.3': '蓝莓',
  'sm.paint.4': '被吹爆的',
  'sm.paint.5': '深蓝加青',
  'sm.paint.6': '深邃又梦幻',
  'sm.paint.7': '蓝紫粉',
  'sm.paint.8': '美如仙境',
  'sm.paint.9': '粉得很',
  'sm.paint.10': '粉红加米',
  'sm.paint.11': '点赞不迷路',
  'sm.paint.12': '好治愈',
  'sm.paint.13': '啥也不说就好看',
  'sm.paint.14': '美腻的三高',
  'sm.paint.15': '红配绿',
  'sm.paint.16': '绝不能沉淀',
  'sm.paint.17': '莫兰迪',

  /* ---------- 02 画布实验：实验内文案 ---------- */
  'cl.bar.note': 'DOM 之上的一层画布',
  'cl.eyebrow': '同一段字 · 四种状态',
  'cl.body':
    '这段文字是真真正正的 HTML —— 可以被选中、被复制、被搜索引擎读到。变化只发生在它上面那一层。',
  'cl.body2': '把光标放上去，按一下，或者干脆停着不动。左边四个效果，作用在同一段字上。',
  'cl.foot.now': '当前效果',
  'cl.foot.dom': '文字仍是可选中的 DOM · 效果运行在上层画布',
  'cl.fx.asciify.name': 'ASCII 化',
  'cl.fx.asciify.desc': '光标扫过处，页面被重绘成 ASCII 点阵',
  'cl.fx.asciify.hint': '移动光标，扫过文字',
  'cl.fx.decrypt.name': '解密',
  'cl.fx.decrypt.desc': '密文在光标附近乱跳，然后逐字落定',
  'cl.fx.decrypt.hint': '靠近它 · 手停住不动会进入子弹时间',
  'cl.fx.ripple.name': '涟漪',
  'cl.fx.ripple.desc': '点击砸出一圈波，字被波推着起伏',
  'cl.fx.ripple.hint': '点击任意位置，多砸几下',
  'cl.fx.glitch.name': '撕帧',
  'cl.fx.glitch.desc': '广播撕帧、RGB 分离与信号噪点',
  'cl.fx.glitch.hint': '看它自己抽风，等一个 burst',

  /* ---------- 04 软体猫：实验内文案 ---------- */
  'sc.bar.note': '摸下去会陷，松手会弹',
  'sc.stage.aria': '可以抚摸的长条猫',
  'sc.hud.sub': '摸背 · 捏耳朵 · 拨尾巴 · 碰爪爪',
  'sc.hud.subEn': 'PET · PRESS · RELEASE',
  'sc.hint': '把光标放到它身上 · 按住会更用力',
  'sc.purr.on': '呼噜 开',
  'sc.purr.off': '呼噜 关',
  'sc.purr.title': '摸它的时候会有呼噜声',
  'sc.coat.0': '墨黑',
  'sc.coat.1': '橘虎斑',
  'sc.coat.2': '奶咖',
  'sc.coat.3': '蓝猫',
  'sc.coat.4': '布偶',
  'sc.coat.5': '樱花',
  'sc.coat.6': '薄荷',
  'sc.coat.7': '奶油',

  /* ---------- 按钮墙 ---------- */
  'btn.paint.cn': '颜色与填充',
  'btn.motion.cn': '位移与形变',
  'btn.click.cn': '按压与粒子',
  'btn.state.cn': '加载与完成',
  'btn.fill-sweep.cn': '颜色扫入',
  'btn.border-draw.cn': '描边绘制',
  'btn.liquid-fill.cn': '液体填充',
  'btn.glow-pulse.cn': '光晕脉冲',
  'btn.magnetic.cn': '磁吸跟随',
  'btn.arrow-slide.cn': '箭头滑入',
  'btn.press-scale.cn': '按压缩放',
  'btn.elastic-stretch.cn': '弹性拉伸',
  'btn.ripple.cn': '涟漪点击',
  'btn.particle-burst.cn': '粒子爆发',
  'btn.cursor-spot.cn': '光标光斑',
  'btn.split-reveal.cn': '分裂展开',
  'btn.loading-morph.cn': '加载形变',
  'btn.success-morph.cn': '成功状态',
  'btn.progress.cn': '进度按钮',
  'btn.flip-3d.cn': '3D 翻转',
  'btn.grp.paint': '颜色与填充',
  'btn.grp.motion': '位移与形变',
  'btn.grp.click': '按压与粒子',
  'btn.grp.state': '加载与完成',
  'btn.more': '看详情',
  'btn.needsJs': '需 JS',
  'btn.needsJs.full': '需 JS 行为层',
  'btn.group.hover': '悬停触发',
  'btn.group.click': '点击触发',

  'btn.fill-sweep.do': '悬停，颜色从左铺满整个按钮。',
  'btn.fill-sweep.how': '一个铺满按钮的色块，平时被横向压扁成 0 宽，悬停时再展开。',
  'btn.border-draw.do': '悬停，边框从左上角开始，一圈画回来。',
  'btn.border-draw.how': '四条边各是一段渐变，按顺序依次展开，看起来像有人拿笔描了一圈。',
  'btn.liquid-fill.do': '悬停，像水位上涨一样漫上来，液面还在晃。',
  'btn.liquid-fill.how': '一层色块从底部升起，顶上跟一个超宽椭圆露出波峰，再横向来回滑动。',
  'btn.glow-pulse.do': '悬停，按钮亮起来，还有一圈光持续向外扩。',
  'btn.glow-pulse.how': '底色和阴影一起变亮，同时一个透明圆环反复向外扩散、淡出。',
  'btn.magnetic.do': '鼠标在按钮上移动，它跟着倾斜、挪动，像被磁铁吸住。',
  'btn.magnetic.how': '光标偏移写进变量，驱动位移 + 旋转 + 放大三件事；内层文字反向微移做视差。',
  'btn.arrow-slide.do': '悬停，文字左移，一个箭头从右边弹进来。',
  'btn.arrow-slide.how': '箭头静止时停在按钮右外侧，悬停时用回弹曲线滑入，同时文字左移让位。',
  'btn.press-scale.do': '按下去会缩，松手弹回来还多弹一下。',
  'btn.press-scale.how': '悬停轻微放大，按下缩小，松开时用一条会过冲的曲线慢慢弹回原位。',
  'btn.elastic-stretch.do': '按住蓄力，松手弹出去；按得越久弹得越大，蓄满会自动释放。',
  'btn.elastic-stretch.how': '按住时横向压缩、纵向鼓起（蓄力）；释放时弹射并做衰减振荡，幅度由蓄力深度决定。',
  'btn.ripple.do': '在按钮上随便点，水波从点击的位置一圈圈荡开。',
  'btn.ripple.how': '在按下坐标叠放四道同心圆环，错峰出发；半径铺满按钮即止，环在扩散中变薄淡出。',
  'btn.particle-burst.do': '点在哪儿，哪儿就炸开一圈小颗粒。',
  'btn.particle-burst.how': '预先埋好 24 个小圆点，点击时按落点分配角度和距离，让它们飞出去、减速、消散。',
  'btn.cursor-spot.do': '鼠标在按钮里划动，一团光跟着你走，文字上还有一道扫光。',
  'btn.cursor-spot.how': '光标位置写进变量：柔光晕 + 锐利高光 + 文字镜面扫光，三层不同视差。',
  'btn.split-reveal.do': '悬停，原来的字左右裂开，新字从中间长出来。',
  'btn.split-reveal.how': '同一行字复制成左右两半，各裁掉一半，悬停时向两侧推开，新的文案在中间放大淡入。',
  'btn.loading-morph.do': '点一下，按钮收成一个圆转起圈来；转完自己撑回长条，写着已保存。',
  'btn.loading-morph.how': '先量出按钮的宽与高，宽度收到等于高度、圆角拉满；转完再按原路撑回去，同时换成已保存的样子。',
  'btn.success-morph.do': '点一下，处理中有一道光扫过；处理完变成绿底的对勾。',
  'btn.success-morph.how': '形状不变，一道柔光在按钮里反复扫过表示处理中；完成后整块转绿，对勾靠描边画出来，外面再散一圈光。',
  'btn.progress.do': '点一下，按钮里的进度条自己走到 100%。',
  'btn.progress.how': '一层半透明的色块按百分比改宽度，右边同步数字；越接近 100% 走得越慢，到 100% 整体转成完成色。',
  'btn.flip-3d.do': '点一下，整块翻个面，颜色跟着翻过来；再来一下翻回去。',
  'btn.flip-3d.how': '正反两面背靠背贴着绕 Y 轴转 180°，同时一层颜色从底/顶铺满；翻转与填充共用同一条时长与缓动。',

  /* ---------- 单个按钮的详情页 ---------- */
  'bp.back': '← 返回 Buttons',
  'bp.hint': '把鼠标放上去 · 点一下试试',
  'bp.play': '怎么玩',
  'bp.how': '怎么做',
  'bp.nav': '其他按钮',
  'bp.prev': '← 上一个',
  'bp.next': '下一个 →',

  /* 404 */
  'nf.mono': '404 / 这里什么都没有',
  'nf.back': '回到首页',
} as const;

export type MsgKey = keyof typeof zh;

const en: Record<MsgKey, string> = {
  'brand.tag': 'New interaction collection',
  'nav.aria': 'Site sections',
  'lang.switch': 'Switch language',
  'lang.zh': '中文',
  'lang.en': 'English',

  'theme.switch': 'Switch theme',
  'theme.light': 'Always light',
  'theme.dark': 'Always dark',
  'theme.system': 'Follow the system',

  'hero.kicker.est': 'Est. 2026 · still collecting',
  'hero.kicker.note': 'Not a single image',
  'hero.lede.a':
    'New things get collected the moment they turn up: ones that flow, ones that tear, ones that spring back, ones that come apart and get put back together. Each one is taken apart until we can see ',
  'hero.lede.hi': 'how it actually works',
  'hero.lede.b':
    ', then rebuilt as a page you can play with. Put a cursor on them — they will let you know they are alive.',
  'hero.meta.since': 'Since',
  'hero.meta.count': '{n}',
  'hero.meta.experiments': 'Experiments',
  'hero.meta.buttons': 'Button effects',
  'hero.meta.status': 'Status',
  'hero.meta.statusValue': 'Still collecting',

  'card.aria': 'Open {name}',
  'card.ariaMeta': '{name} · jump to this section',

  'exp.head.meta': '{n} · playable',
  'btn.head.meta': '{n} · hover / click / release',
  'btn.lede':
    'Every effect shares one set of durations and easing curves, so they feel consistent side by side. Each one opens to show how it moves and which timing step it uses. These are real buttons — go ahead.',
  'grow.head.meta': 'How this place updates',
  'log.head.meta': 'Current {v} · {n} versions',
  'log.lede':
    'This site is still growing. Every change is logged below, newest first — the last digit of the version goes up on every change.',
  'loading.experiment': 'Loading experiment…',

  'destroy.head.meta': 'A site you can take apart',
  'destroy.lede':
    "Somebody else's game, kept here as an entry point: type in any address and that page turns into a map you can jump around on — the rest is up to you.",
  'destroy.step1.t': 'Type an address',
  'destroy.step1.d':
    'Any address will do. It gets drawn as a map you can stand on — text and images become terrain.',
  'destroy.step2.t': 'Take it apart',
  'destroy.step2.d':
    'Seven weapons on a wheel, grenades on right-click; fill the progress bar at the top and the round is over. Up to six people can pile in at once — one works too.',
  'destroy.step3.t': 'Nothing real is touched',
  'destroy.step3.d':
    'It draws a copy of the page into its own canvas. No site loses any data. It is a toy, not a tool.',
  'destroy.start': 'Destroy this site',
  'destroy.other': 'or go take apart a different site',

  'foot.experiments': '{n} experiments · updated often',
  'foot.log': 'Dev log {v}',
  'foot.changelog': 'Changelog →',
  'foot.star': '★ Star it on GitHub',
  'foot.credit': 'Inspired by soft-matter · canvas-ui · every effect computed live',


  /* ---------- Cloud Train: everything you can operate ---------- */
  'ct.title': 'Cloud Train',
  'ct.lede': 'Fourteen layers of cloud, one train, one bridge.',
  'ct.sub': 'A picture that drives away',
  'ct.custom': 'Custom',
  'ct.export': 'Export as HTML',
  'ct.export.title': 'Write the current light into a file you can open by double-clicking it',
  'ct.back': 'Back to the list',
  'ct.stage': 'Sunset Cloud Train',

  'ct.bar.note': '{name} · a sea of cloud, one train',
  'ct.hud.title.a': 'Cloud',
  'ct.hud.title.b': 'Train.',
  'ct.hud.sub': '14 layers of cloud · a suspension bridge · steam',
  'ct.hud.subEn': '14 CLOUD LAYERS · SUSPENSION BRIDGE · STEAM',

  'ct.panel.open': 'Light panel',
  'ct.panel.title': 'Light',
  'ct.panel.close': 'Close the panel',
  'ct.panel.gripClose': 'Collapse the light panel',
  'ct.panel.gripOpen': 'Expand the light panel',
  'ct.panel.changed': '{name}, edited',
  'ct.panel.edited': 'Edited',
  'ct.panel.preset': 'Presets',
  'ct.panel.tintedNote': 'Changed below under Colour — this is {base} plus your own adjustments.',
  'ct.panel.revert': 'Back to “{name}”',

  'ct.dock.restore': 'Reset all',
  'ct.dock.restore.title': 'Everything back to how it opened: sunset, default speed, opening replayed',
  'ct.dock.shuffle': 'New light',
  'ct.dock.shuffle.title': 'Colour only — speed and framing stay put (avoids the same family, inverts value and intensity)',
  'ct.dock.pause': 'Pause',
  'ct.dock.resume': 'Resume',
  'ct.dock.replay': 'Replay',
  'ct.dock.replay.title': 'Replay the opening: the cloud layers reveal again',
  'ct.dock.keep': 'Keep here',
  'ct.dock.kept': 'Kept',
  'ct.dock.keep.title': 'Keep this light on this device; it will be here next time',
  'ct.err': 'Could not render: {msg}',
  'ct.err.webgl2': 'WebGL 2 is required',

  'ct.group.frame': 'Picture',
  'ct.group.light': 'Light',
  'ct.group.tail': 'Finish',
  'ct.group.colour': 'Colour',
  'ct.group.colour.badge': 'Edited',
  'ct.more': '{n} more',
  'ct.less': 'Fewer',

  'ct.tint.lightLabel': 'Light · changes the key of the whole picture',
  'ct.tint.objLabel': 'Object · stains one part',
  'ct.tint.sky': 'Sky',
  'ct.tint.sky.hint': 'where the clouds part',
  'ct.tint.train': 'Train',
  'ct.tint.train.hint': 'flat colour, keeps its shading',
  'ct.tint.smoke': 'Steam',
  'ct.tint.smoke.hint': 'multiplied · white = unchanged',
  'ct.tint.shadow': 'Shadows',
  'ct.tint.shadow.hint': 'the darkest light',
  'ct.tint.mid': 'Midtones',
  'ct.tint.mid.hint': 'the body of the cloud',
  'ct.tint.high': 'Highlights',
  'ct.tint.high.hint': 'cloud tops and sun',

  'ct.sl.speed': 'Speed',
  'ct.sl.zoom': 'Zoom',
  'ct.sl.offset': 'Vertical position',
  'ct.sl.amplitude': 'Cloud swell',
  'ct.sl.detail': 'Noise detail',
  'ct.sl.feedback': 'Smear',
  'ct.sl.grade': 'Grade strength',
  'ct.sl.temperature': 'Warm / cool',
  'ct.sl.exposure': 'Exposure',
  'ct.sl.saturation': 'Saturation',
  'ct.sl.hue': 'Hue',
  'ct.sl.vignette': 'Vignette',
  'ct.sl.grain': 'Grain',
  'ct.sl.resolution': 'Render scale',
  'ct.sl.introDuration': 'Opening length',
  'ct.sl.introFeather': 'Opening feather',

  /* ---------- Cloud Train: the palette presets ----------
     A palette name is a name, not a description: one or two words, the way a
     paint chip or a preset slot would be labelled. Hints have to stay short —
     they sit in a 108px cell. */
  'fam.warm': 'Analogous',
  'fam.warm.hint': 'split by value, quiet',
  'fam.cool': 'Cool',
  'fam.cool.hint': 'the same, colder',
  'fam.neutral': 'Neutral',
  'fam.neutral.hint': 'barely any hue, all value',
  'fam.vivid': 'Vivid',
  'fam.vivid.hint': 'high chroma, no clash',
  'fam.duotone': 'Duotone',
  'fam.duotone.hint': 'two sweet hues, split by value',
  'fam.clash': 'Clash',
  'fam.clash.hint': '100°+ apart, the frame tears',
  'fam.acid': 'Dopamine',
  'fam.acid.hint': 'fluorescent on fluorescent, loudest',

  'pal.sunset.name': 'Sunset',
  'pal.sunset.note': 'The original warm orange, a low sun, cloud tops still hot',
  'pal.ink.name': 'Ink Wash',
  'pal.ink.note': 'Saturation drained out, only value left, clouds bleeding into rice paper',
  'pal.aurora.name': 'Aurora',
  'pal.aurora.note': 'Cold green on the backs of the clouds, mint in the highlights, violet at the edges',
  'pal.dusk.name': 'Blue Hour',
  'pal.dusk.note': 'The sun has gone, clouds cut down to silhouettes, the sky pressed low',
  'pal.sakura.name': 'Sakura',
  'pal.sakura.note': 'The warm orange swapped out entirely, cloud tops pink-white, the light gone soft',
  'pal.solar.name': 'High Noon',
  'pal.solar.note': 'Light pressing straight down, hardly any shadow, flat and a little hard',
  'pal.ember.name': 'Ember',
  'pal.ember.note': 'Only dark red and black, like the coal that keeps glowing after the fire',
  'pal.neon.name': 'Neon',
  'pal.neon.note': 'Cyan into magenta, highlights blown out, the whole frame pushed under candy wrapper',

  'pal.acid-rose.name': 'Acid Rose',
  'pal.acid-rose.note': 'Fluorescent yellow-green into rose, sour in the shadows, sweet in the highlights, a wide unsteady green between',
  'pal.acid-violet.name': 'Acid Violet',
  'pal.acid-violet.note': 'Toxic green against deep violet, 171° exact complement, the bluntest set in the collection',
  'pal.ultramarine.name': 'Ultramarine',
  'pal.ultramarine.note': 'Ultramarine over gold, 179° exact complement, blue pushed to violet, gold burned to white',
  'pal.red-cyan.name': 'Red Cyan',
  'pal.red-cyan.note': 'True red against cyan, 174°, the oldest clash in the book and too steady to go wrong',
  'pal.pumpkin.name': 'Pumpkin',
  'pal.pumpkin.note': 'Pumpkin orange against turquoise, 146°, warm and cold head-on, not harsh but loud',
  'pal.blue-lime.name': 'Blue Lime',
  'pal.blue-lime.note': 'Deep blue into lime, 155°, a cool face on a warm core, like one fluorescent tube left on in the dark',
  'pal.violet-yellow.name': 'Violet Lime',
  'pal.violet-yellow.note': 'Violet against lime, 152°, a shade warmer than Blue Lime, more of the sugar',
  'pal.mint-coral.name': 'Mint',
  'pal.mint-coral.note': 'Mint against coral, 161°, both sweet, held apart by value alone',
  'pal.teal-coral.name': 'Ink Rose',
  'pal.teal-coral.note': 'Deep teal against rose, 177°, shadows pushed very low, one pink highlight holding up the whole frame',
  'pal.electric.name': 'Electric',
  'pal.electric.note': 'Cyan against magenta, 125°, cyberpunk but restrained, the midtones only stay tasteful while they are dark',
  'pal.fuchsia-lime.name': 'Magenta',
  'pal.fuchsia-lime.note': 'Magenta against yellow-green, 129°, the loudest of the dopamine set',
  'pal.sherbet.name': 'Sherbet',
  'pal.sherbet.note': 'Lime blue against peach, 153°, all three bright enough to read as a gradient, except the shadows, pushed deep',
  /* ---------- cloud-sea family: low hue gap, high value gap ---------- */
  'fam.sea': 'Cloud sea',
  'fam.sea.hint': 'One hue, values only',
  /* "Violet Haze" over "Lotus": the colour is literally a haze, and the
     screenshot it was sampled from reads as one. Lotus describes the
     pigment; haze describes the picture. */
  'pal.violetSea.name': 'Violet Haze',
  'pal.violetSea.note':
    'Lotus-purple overhead, blush-lit cloud tops, a heavy violet sea — one hue family, separated only by value',
  'pal.snowRidge.name': 'Snow Ridge',
  'pal.snowRidge.note':
    'Slate peaks, a ridge bright enough to sting, valleys dark as ink',
  'pal.nightTide.name': 'Night Tide',
  'pal.nightTide.note':
    'A deep blue night, a violet swell, one cold white on the crest — the cloud sea, coming up in the dark',


  /* growth panel */
  'grow.step1.t': 'Drop it in',
  'grow.step1.d':
    'Send over anything new — a component library, an open-source toy, a demo of an effect. A link or a screenshot both work.',
  'grow.step2.t': 'Take it apart',
  'grow.step2.d':
    'Work out how it actually does it: shader, physics, or a sleight of hand. Keep the smallest, most reusable piece.',
  'grow.step3.t': 'Make it playable',
  'grow.step3.d':
    'Written up as its own experiment in the list, with a panel of adjustable parameters. Later you can pick it up as a part.',
  'grow.stat.exp': 'experiments',
  'grow.stat.btn': 'button effects',
  'grow.stat.img': 'images / all computed live',
  'grow.note':
    'Not one image file here. Every jelly, every ripple, every rebound is computed by the page as you watch — which is why they can be grabbed, pressed, and find their way back to shape after you let go.',

/* ---------- experiment cards / wip placeholder ---------- */
  'exp.notOpen': 'Not open yet',
  'exp.openAria': 'Open the experiment',
  'exp.openGo': 'Open the experiment →',
  'exp.wipGo': 'See what it is doing →',
  'wip.kicker': 'Not quite tame yet',
  'exp.wipFlag': 'Not open yet',
  'exp.thumbLabel': 'preview of {name}',

  /* ---------- one shared way back out of an experiment ---------- */
  'ui.back': 'Back to the list',
  'ui.elsewhere': 'Look at something else',

  /* ---------- 01 Soft Matter: inside the experiment ----------
     The four slider names are the reference project's own controls, so they
     are the plainest English words that still separate them: elasticity is
     how much it springs back, damping is how fast it stops, translucency is
     how much light gets through the shell. */
  'sm.bar.note': 'Press and squeeze · let go and it comes back on its own',
  'sm.stage.aria': 'A soft body you can pull around in three dimensions',
  'sm.hud.sub': 'Drag to shape · Release to recover · Double-click to bounce',
  'sm.hud.subEn': 'TOUCH · STRETCH · RELEASE',
  'sm.panel.open': 'Material panel',
  'sm.panel.aria': 'Soft body settings',
  'sm.panel.sub': '01 / Soft matter',
  'sm.panel.close': 'Close the panel',
  'sm.hint': 'Press the surface to push it down · grab an edge to lift it off the floor',
  'sm.bounce': 'Bounce it',
  'sm.pause': 'Pause',
  'sm.resume': 'Resume',
  'sm.slow': 'Slow motion',
  'sm.normal': 'Full speed',
  'sm.slow.title': 'Slow motion drops time to 0.22× so you can watch what happens when it lands',
  'sm.field.shape': 'Shape',
  'sm.field.colour': 'Colour',
  'sm.field.elasticity': 'Elasticity',
  'sm.field.damping': 'Damping',
  'sm.field.glass': 'Translucency',
  'sm.field.spin': 'Turntable',
  'sm.field.shapeColour': 'This shape carries its own colour — drop the translucency to see it',
  'sm.custom': 'Custom',
  'sm.custom.title': 'Mix your own colour',
  'sm.random': 'Surprise me',
  'sm.reset': 'Reset',
  'sm.shape.ghost': 'Lime Jelly Sprite',
  'sm.shape.watermelon': 'Watermelon Jelly',
  'sm.shape.bear': 'Bear Jelly',
  'sm.shape.star': 'Star Jelly',
  'sm.shape.orb': 'Orb',
  'sm.shape.cube': 'Sugar Cube',
  /* The first four are the reference project's own flat presets. The rest came
     from a gradient library whose names are Chinese internet one-liners — a few
     of them cannot be carried over without turning into a joke about a
     different joke, so those keep the plain colour word instead. */
  'sm.paint.0': 'Watermelon',
  'sm.paint.1': 'Jade',
  'sm.paint.2': 'Amber',
  'sm.paint.3': 'Blueberry',
  'sm.paint.4': 'Blown Out',
  'sm.paint.5': 'Deep Blue & Cyan',
  'sm.paint.6': 'Deep & Dreamy',
  'sm.paint.7': 'Blue Violet Pink',
  'sm.paint.8': 'Otherworldly',
  'sm.paint.9': 'Very Pink',
  'sm.paint.10': 'Pink & Cream',
  'sm.paint.11': 'Like & Subscribe',
  'sm.paint.12': 'Deeply Calming',
  'sm.paint.13': 'Silent & Pretty',
  'sm.paint.14': 'Rich & Creamy',
  'sm.paint.15': 'Red & Green',
  'sm.paint.16': 'Never Settles',
  'sm.paint.17': 'Morandi',

  /* ---------- 02 Canvas Lab: inside the experiment ---------- */
  'cl.bar.note': 'One canvas layer above the DOM',
  'cl.eyebrow': 'One paragraph · Four states',
  'cl.body':
    'This paragraph is real HTML — selectable, copyable, readable by a search engine. Only the layer on top of it changes.',
  'cl.body2':
    'Move the cursor over it, press, or simply leave it alone. Four effects on the left, all acting on the same paragraph.',
  'cl.foot.now': 'Effect',
  'cl.foot.dom': 'The text is still selectable DOM · the effect runs on a canvas above it',
  'cl.fx.asciify.name': 'Asciify',
  'cl.fx.asciify.desc': 'Where the cursor passes, the page repaints as an ASCII grid',
  'cl.fx.asciify.hint': 'Sweep the cursor across the text',
  'cl.fx.decrypt.name': 'Decrypt',
  'cl.fx.decrypt.desc': 'Ciphertext thrashes near the cursor, then settles letter by letter',
  'cl.fx.decrypt.hint': 'Come close · hold still and it drops into bullet time',
  'cl.fx.ripple.name': 'Ripple',
  'cl.fx.ripple.desc': 'A click drops a ring, and the letters ride the wave',
  'cl.fx.ripple.hint': 'Click anywhere, as many times as you like',
  'cl.fx.glitch.name': 'Glitch',
  'cl.fx.glitch.desc': 'Broadcast tearing, RGB separation, signal noise',
  'cl.fx.glitch.hint': 'Watch it misbehave on its own and wait for a burst',

  /* ---------- 04 Soft Cat: inside the experiment ----------
     The coat names are the cat-colour words an English speaker already has;
     two of them (tabby, calico-ish ragdoll) are the breed words, which is what
     the Chinese was reaching for anyway. */
  'sc.bar.note': 'Pet it and it sinks in · let go and it springs back',
  'sc.stage.aria': 'A very long cat you can pet',
  'sc.hud.sub': 'Back · Ears · Tail · Paws',
  'sc.hud.subEn': 'PET · PRESS · RELEASE',
  'sc.hint': 'Put the cursor on it · press harder to push further',
  'sc.purr.on': 'Purr on',
  'sc.purr.off': 'Purr off',
  'sc.purr.title': 'It purrs while you pet it',
  'sc.coat.0': 'Ink',
  'sc.coat.1': 'Orange Tabby',
  'sc.coat.2': 'Latte',
  'sc.coat.3': 'Blue',
  'sc.coat.4': 'Ragdoll',
  'sc.coat.5': 'Cherry Blossom',
  'sc.coat.6': 'Mint',
  'sc.coat.7': 'Cream',

  /* ---------- the button wall ----------
     `do` is what the visitor does, `how` is the one sentence underneath it.
     English splits them the same way, but the sentences get reordered so the
     clause that names the trigger comes first — a visitor reads the first three
     words to decide whether to try it. */
  'btn.paint.cn': 'Colour & Fill',
  'btn.motion.cn': 'Shift & Shape',
  'btn.click.cn': 'Press & Sparks',
  'btn.state.cn': 'Load & Done',
  'btn.fill-sweep.cn': 'Fill Sweep',
  'btn.border-draw.cn': 'Border Draw',
  'btn.liquid-fill.cn': 'Liquid Fill',
  'btn.glow-pulse.cn': 'Glow Pulse',
  'btn.magnetic.cn': 'Magnetic',
  'btn.arrow-slide.cn': 'Arrow Slide',
  'btn.press-scale.cn': 'Press Scale',
  'btn.elastic-stretch.cn': 'Elastic Stretch',
  'btn.ripple.cn': 'Ripple',
  'btn.particle-burst.cn': 'Particle Burst',
  'btn.cursor-spot.cn': 'Cursor Spot',
  'btn.split-reveal.cn': 'Split Reveal',
  'btn.loading-morph.cn': 'Loading Morph',
  'btn.success-morph.cn': 'Success Morph',
  'btn.progress.cn': 'Progress',
  'btn.flip-3d.cn': '3D Flip',
  'btn.grp.paint': 'Colour & Fill',
  'btn.grp.motion': 'Shift & Shape',
  'btn.grp.click': 'Press & Sparks',
  'btn.grp.state': 'Load & Done',
  'btn.more': 'See how it works',
  'btn.needsJs': 'Needs JS',
  'btn.needsJs.full': 'Needs the JS behaviour layer',
  'btn.group.hover': 'on hover',
  'btn.group.click': 'on click',

  'btn.fill-sweep.do': 'Hover, and the colour sweeps in from the left until the whole button is filled.',
  'btn.fill-sweep.how': 'A block the size of the button, squashed flat to zero width until hover, then let out.',
  'btn.border-draw.do': 'Hover, and the border draws itself from the top-left corner all the way round.',
  'btn.border-draw.how': 'Each side is a gradient of its own, opened in sequence, so it reads as a pen going round once.',
  'btn.liquid-fill.do': 'Hover, and it rises like a water level. The surface keeps moving afterwards.',
  'btn.liquid-fill.how': 'A block lifts from the bottom with a very wide ellipse riding on top as the wave crest, sliding back and forth.',
  'btn.glow-pulse.do': 'Hover, and the button lights up while a ring of light keeps spreading outward.',
  'btn.glow-pulse.how': 'The fill and the shadow brighten together while a transparent ring repeats outward and fades.',
  'btn.magnetic.do': 'Move the mouse across it and it tilts and slides after you, pulled along like something magnetic.',
  'btn.magnetic.how': 'The cursor offset goes into a variable driving three things at once: position, rotation and scale. The label inside shifts the other way for parallax.',
  'btn.arrow-slide.do': 'Hover, the text moves left, and an arrow springs in from the right.',
  'btn.arrow-slide.how': 'The arrow rests just outside the right edge, then slides in on a spring curve while the text moves over to make room.',
  'btn.press-scale.do': 'Press and it shrinks. Let go and it springs back, then bounces once more.',
  'btn.press-scale.how': 'A slight scale up on hover, a squash under press, then a slow return along a curve that overshoots before it settles.',
  'btn.elastic-stretch.do': 'Hold to load it, release to fire. The longer you hold the further it throws, and a full charge lets go by itself.',
  'btn.elastic-stretch.how': 'Holding squashes it wide and bulges it tall to store the charge. Releasing fires it out with a decaying wobble whose size comes from how deep the charge was.',
  'btn.ripple.do': 'Click anywhere on it and rings spread out from the spot you hit.',
  'btn.ripple.how': 'Four concentric rings are stacked at the press coordinates and released a beat apart. Each one stops when it has covered the button, thinning as it goes.',
  'btn.particle-burst.do': 'Click anywhere and a ring of small grains goes off from that spot.',
  'btn.particle-burst.how': 'Twenty-four dots are placed in advance. On click each one is given an angle and a distance from the hit point, then flies out, slows and dissolves.',
  'btn.cursor-spot.do': 'Run the mouse through it and a pool of light follows you, with a highlight sweeping across the label.',
  'btn.cursor-spot.how': 'The cursor position goes into a variable: a soft bloom, a sharp specular, and a mirrored sweep across the text, each on its own depth.',
  'btn.split-reveal.do': 'Hover, and the old words split to the left and right while new ones grow out of the middle.',
  'btn.split-reveal.how': 'One line of text is copied into a left half and a right half, each cropped. On hover they push apart and the new copy scales up in the gap and fades in.',
  'btn.loading-morph.do': 'Click it: the button draws itself into a circle and spins. When it is done it stretches back into a bar reading Saved.',
  'btn.loading-morph.how': 'It measures its own width and height first, then narrows to a square with the corners fully rounded. Afterwards it expands back the way it came, now showing the saved state.',
  'btn.success-morph.do': 'Click it: a light sweeps across while it works, and at the end it turns into a green tick.',
  'btn.success-morph.how': 'The shape never changes — a soft light sweeps back and forth to show that it is working. Then the whole block goes green, the tick is drawn as a stroke, and a ring of light scatters off it.',
  'btn.progress.do': 'Click it and the progress bar inside walks itself all the way to 100%.',
  'btn.progress.how': 'A translucent block changes width to the percentage, with the number keeping pace beside it. The closer to 100% the slower it goes, and at 100% the whole thing turns to the done colour.',
  'btn.flip-3d.do': 'Click it and the whole thing turns over, colour and all. Click again and it turns back.',
  'btn.flip-3d.how': 'Front and back sit back to back and rotate 180° around the Y axis while a colour fills in from the bottom or top. The flip and the fill share one duration and one easing.',

  /* ---------- one button, up close ---------- */
  'bp.back': '← Back to Buttons',
  'bp.hint': 'Put the mouse on it · click it once',
  'bp.play': 'How to play it',
  'bp.how': 'How it works',
  'bp.nav': 'Other buttons',
  'bp.prev': '← Previous',
  'bp.next': 'Next →',

  'nf.mono': '404 / nothing here',
  'nf.back': 'Back to home',
};

const DICT: Record<Lang, Record<MsgKey, string>> = { zh, en };

/* ---------- store ---------- */

function detect(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    /* storage disabled — detection below still works */
  }
  // Anything that is not an English browser gets Chinese: the bulk of the
  // collection is written in Chinese, so that is the safer default.
  return (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
}

let current: Lang = detect();
const listeners = new Set<() => void>();

function applyHtmlLang(lang: Lang): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }
}
applyHtmlLang(current);

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* remember-in-memory is still better than nothing */
  }
  applyHtmlLang(lang);
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/* ---------- lookup ---------- */

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/** Non-React lookup — for module-level helpers. */
export function tr(key: MsgKey, vars?: Vars, lang: Lang = current): string {
  return interpolate(DICT[lang][key] ?? DICT.zh[key] ?? key, vars);
}

/**
 * The hook everything in the UI uses. Returning `t` from here (rather than
 * importing a global) is what makes a language change re-render the tree.
 */
export function useLang(): {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MsgKey, vars?: Vars) => string;
} {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  const t = useCallback((key: MsgKey, vars?: Vars) => tr(key, vars, lang), [lang]);
  return { lang, setLang, t };
}
