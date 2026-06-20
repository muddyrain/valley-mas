export type DesktopAppId =
  | 'about'
  | 'finder'
  | 'notes'
  | 'music'
  | 'weather'
  | 'safari'
  | 'calendar'
  | 'settings'
  | 'downloads'
  | 'account'
  | 'calculator'
  | 'focus'
  | 'randomizer'
  | 'clipboard'
  | 'converter'
  | 'textLab'
  | 'palette'
  | 'stopwatch'
  | 'plushMatch'
  | 'deskTidy'
  | 'beadSort'
  | 'plushGarden'
  | 'cloudBounce';

export type DesktopAppCategory = 'system' | 'tool' | 'game' | 'content';

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
    width: 420,
    height: 380,
    category: 'system',
    keywords: ['account', 'login', '账户', '登录'],
    dockDefault: true,
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
    width: 520,
    height: 500,
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
};

export const DESKTOP_APP_LIST = Object.values(DESKTOP_APPS);

export function getDesktopApp(appId: DesktopAppId) {
  return DESKTOP_APPS[appId];
}

export function getDefaultWindowOptions(appId: DesktopAppId) {
  const app = getDesktopApp(appId);
  return {
    title: app.title,
    width: app.width,
    height: app.height,
  };
}
