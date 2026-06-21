export type DesktopAppId =
  | 'about'
  | 'finder'
  | 'blog'
  | 'mail'
  | 'notes'
  | 'music'
  | 'weather'
  | 'safari'
  | 'calendar'
  | 'settings'
  | 'downloads'
  | 'account'
  | 'aiTools'
  | 'calculator'
  | 'focus'
  | 'randomizer'
  | 'clipboard'
  | 'converter'
  | 'textLab'
  | 'palette'
  | 'stopwatch'
  | 'devTools'
  | 'dailyTools'
  | 'plushMatch'
  | 'deskTidy'
  | 'beadSort'
  | 'plushGarden'
  | 'cloudBounce'
  | 'diceCup'
  | 'blockDrop'
  | 'snake';

export type DesktopAppCategory = 'system' | 'tool' | 'game' | 'content';
export type DesktopAppRuntimePolicy = 'foreground-only' | 'background-allowed';
export const DEFAULT_RUNTIME_POLICY = 'foreground-only' satisfies DesktopAppRuntimePolicy;

export interface DesktopApp {
  id: DesktopAppId;
  title: string;
  icon: string;
  width: number;
  height: number;
  category: DesktopAppCategory;
  keywords: string[];
  dockDefault: boolean;
  dockEligible?: boolean;
  dockRequired?: boolean;
  runtimePolicy?: DesktopAppRuntimePolicy;
}

export const DESKTOP_APPS: Record<DesktopAppId, DesktopApp> = {
  about: {
    id: 'about',
    title: '关于本机',
    icon: '/icons/settings.png',
    width: 520,
    height: 360,
    category: 'system',
    keywords: ['about', 'system', '本机', '系统'],
    dockDefault: false,
  },
  finder: {
    id: 'finder',
    title: 'Finder',
    icon: '/icons/finder.png',
    width: 820,
    height: 520,
    category: 'system',
    keywords: ['finder', 'file', 'resource', '资源', '文件'],
    dockDefault: true,
    dockRequired: true,
  },
  blog: {
    id: 'blog',
    title: '博客',
    icon: '/icons/blog.png',
    width: 900,
    height: 620,
    category: 'content',
    keywords: ['blog', 'post', 'article', '博客', '文章', '阅读'],
    dockDefault: true,
  },
  mail: {
    id: 'mail',
    title: '邮件',
    icon: '/icons/mail.png',
    width: 860,
    height: 560,
    category: 'content',
    keywords: ['mail', 'email', 'inbox', '邮件', '邮箱', '收件箱'],
    dockDefault: true,
  },
  notes: {
    id: 'notes',
    title: '便签',
    icon: '/icons/notes.png',
    width: 480,
    height: 320,
    category: 'tool',
    keywords: ['notes', 'memo', 'note', '便签', '速记'],
    dockDefault: true,
  },
  music: {
    id: 'music',
    title: '音乐',
    icon: '/icons/music.png',
    width: 780,
    height: 500,
    category: 'content',
    keywords: ['music', 'radio', '音乐', '播放'],
    dockDefault: true,
    runtimePolicy: 'background-allowed',
  },
  weather: {
    id: 'weather',
    title: '天气',
    icon: '/icons/weather.png',
    width: 760,
    height: 520,
    category: 'tool',
    keywords: ['weather', 'forecast', '天气', '预报', '温度'],
    dockDefault: true,
  },
  safari: {
    id: 'safari',
    title: 'Safari',
    icon: '/icons/safari.png',
    width: 760,
    height: 500,
    category: 'system',
    keywords: ['safari', 'browser', 'web', '浏览器', '网页'],
    dockDefault: true,
  },
  calendar: {
    id: 'calendar',
    title: '日历',
    icon: '/icons/calendar.png',
    width: 820,
    height: 560,
    category: 'tool',
    keywords: ['calendar', 'date', '日历', '日期'],
    dockDefault: true,
  },
  settings: {
    id: 'settings',
    title: '系统设置',
    icon: '/icons/settings.png',
    width: 620,
    height: 460,
    category: 'system',
    keywords: ['settings', 'preferences', '设置', '系统设置'],
    dockDefault: true,
  },
  downloads: {
    id: 'downloads',
    title: '下载',
    icon: '/icons/downloads.png',
    width: 640,
    height: 420,
    category: 'system',
    keywords: ['downloads', 'download', '下载'],
    dockDefault: true,
  },
  account: {
    id: 'account',
    title: '账户',
    icon: '/icons/keychain.png',
    width: 620,
    height: 520,
    category: 'system',
    keywords: ['account', 'login', '账户', '登录'],
    dockDefault: true,
  },
  aiTools: {
    id: 'aiTools',
    title: 'AI Command Center',
    icon: '/icons/stationery.png',
    width: 1180,
    height: 720,
    category: 'tool',
    keywords: [
      'ai',
      'chat',
      'summary',
      'translate',
      'rewrite',
      'prompt',
      'AI',
      '对话',
      '总结',
      '翻译',
      '改写',
      '提示词',
    ],
    dockDefault: false,
    dockEligible: true,
  },
  calculator: {
    id: 'calculator',
    title: '小算盘',
    icon: '/icons/calculator.png',
    width: 360,
    height: 460,
    category: 'tool',
    keywords: ['calculator', 'calc', '计算器', '计算', '小算盘'],
    dockDefault: false,
    dockEligible: true,
  },
  focus: {
    id: 'focus',
    title: '专注钟',
    icon: '/icons/clock.png',
    width: 420,
    height: 420,
    category: 'tool',
    keywords: ['focus', 'timer', 'pomodoro', '专注', '番茄钟'],
    dockDefault: false,
    dockEligible: true,
    runtimePolicy: 'background-allowed',
  },
  randomizer: {
    id: 'randomizer',
    title: '抽签罐',
    icon: '/icons/lucky-bag.png',
    width: 500,
    height: 420,
    category: 'tool',
    keywords: ['random', 'dice', 'coin', '抽签', '骰子', '硬币'],
    dockDefault: false,
    dockEligible: true,
  },
  clipboard: {
    id: 'clipboard',
    title: '剪贴板',
    icon: '/icons/stationery.png',
    width: 500,
    height: 520,
    category: 'tool',
    keywords: ['clipboard', 'snippet', 'copy', '剪贴板', '片段', '复制'],
    dockDefault: false,
    dockEligible: true,
  },
  converter: {
    id: 'converter',
    title: '换算器',
    icon: '/icons/calculator.png',
    width: 520,
    height: 500,
    category: 'tool',
    keywords: ['converter', 'unit', '单位', '换算', '长度', '温度'],
    dockDefault: false,
    dockEligible: true,
  },
  textLab: {
    id: 'textLab',
    title: '文本工坊',
    icon: '/icons/notes.png',
    width: 560,
    height: 520,
    category: 'tool',
    keywords: ['text', 'format', 'url', '文本', '字数', '编码'],
    dockDefault: false,
    dockEligible: true,
  },
  palette: {
    id: 'palette',
    title: '调色盘',
    icon: '/icons/photos-flower.png',
    width: 520,
    height: 560,
    category: 'tool',
    keywords: ['palette', 'color', 'hex', '颜色', '调色', '取色'],
    dockDefault: false,
    dockEligible: true,
  },
  stopwatch: {
    id: 'stopwatch',
    title: '秒表',
    icon: '/icons/clock.png',
    width: 440,
    height: 520,
    category: 'tool',
    keywords: ['stopwatch', 'timer', 'countdown', '秒表', '倒计时', '计时'],
    dockDefault: false,
    dockEligible: true,
  },
  devTools: {
    id: 'devTools',
    title: '开发工具箱',
    icon: '/icons/terminal.png',
    width: 860,
    height: 600,
    category: 'tool',
    keywords: [
      'devtools',
      'json',
      'timestamp',
      'base64',
      'uuid',
      'diff',
      'csv',
      '开发',
      '工具箱',
      '时间戳',
      '编码',
    ],
    dockDefault: false,
    dockEligible: true,
  },
  dailyTools: {
    id: 'dailyTools',
    title: '日常工具箱',
    icon: '/icons/widgets.png',
    width: 760,
    height: 560,
    category: 'tool',
    keywords: [
      'daily',
      'password',
      'date',
      'image',
      'bill',
      '日常',
      '密码',
      '日期',
      '图片',
      '分账',
    ],
    dockDefault: false,
    dockEligible: true,
  },
  plushMatch: {
    id: 'plushMatch',
    title: '毛绒配对',
    icon: '/icons/favorites-star.png',
    width: 560,
    height: 560,
    category: 'game',
    keywords: ['match', 'memory', 'game', '配对', '记忆', '小游戏'],
    dockDefault: false,
    dockEligible: true,
  },
  deskTidy: {
    id: 'deskTidy',
    title: '桌面收纳',
    icon: '/icons/system-cleaner.png',
    width: 640,
    height: 520,
    category: 'game',
    keywords: ['tidy', 'sort', 'game', '收纳', '整理', '小游戏'],
    dockDefault: false,
    dockEligible: true,
  },
  beadSort: {
    id: 'beadSort',
    title: '色珠整理',
    icon: '/icons/favorites-star.png',
    width: 560,
    height: 540,
    category: 'game',
    keywords: ['bead', 'sort', 'puzzle', '色珠', '整理', '小游戏'],
    dockDefault: false,
    dockEligible: true,
  },
  plushGarden: {
    id: 'plushGarden',
    title: '毛绒花园',
    icon: '/icons/eco-leaf.png',
    width: 700,
    height: 540,
    category: 'game',
    keywords: ['garden', 'plant', 'idle', '花园', '浇水', '小游戏'],
    dockDefault: false,
    dockEligible: true,
  },
  cloudBounce: {
    id: 'cloudBounce',
    title: '云朵弹跳',
    icon: '/icons/weather.png',
    width: 500,
    height: 540,
    category: 'game',
    keywords: ['cloud', 'bounce', 'arcade', '云朵', '弹跳', '小游戏'],
    dockDefault: false,
    dockEligible: true,
  },
  diceCup: {
    id: 'diceCup',
    title: '骰盅',
    icon: '/icons/lucky-bag.png',
    width: 760,
    height: 680,
    category: 'game',
    keywords: ['dice', 'cup', 'shake', '骰子', '骰盅', '摇骰', '喝酒'],
    dockDefault: false,
    dockEligible: true,
  },
  blockDrop: {
    id: 'blockDrop',
    title: '方块下落',
    icon: '/icons/favorites-star.png',
    width: 620,
    height: 640,
    category: 'game',
    keywords: ['tetris', 'block', '俄罗斯方块', '方块', '消除', '小游戏'],
    dockDefault: false,
    dockEligible: true,
  },
  snake: {
    id: 'snake',
    title: '贪吃蛇',
    icon: '/icons/eco-leaf.png',
    width: 560,
    height: 620,
    category: 'game',
    keywords: ['snake', 'arcade', '贪吃蛇', '街机', '小游戏'],
    dockDefault: false,
    dockEligible: true,
  },
};

export const DESKTOP_APP_LIST = Object.values(DESKTOP_APPS);

export function getDesktopApp(appId: DesktopAppId) {
  return DESKTOP_APPS[appId];
}

export function getDesktopAppRuntimePolicy(appId: DesktopAppId) {
  return getDesktopApp(appId).runtimePolicy ?? DEFAULT_RUNTIME_POLICY;
}

export function getDefaultWindowOptions(appId: DesktopAppId) {
  const app = getDesktopApp(appId);
  return {
    title: app.title,
    width: app.width,
    height: app.height,
  };
}
