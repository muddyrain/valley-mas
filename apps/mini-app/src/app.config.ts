export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/creator/index',
    'pages/discover/index',
    'pages/mine/index',
    'pages/creator-profile/index',
  ],
  tabBar: {
    color: '#999999',
    selectedColor: '#7B61FF',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: './assets/icons/home.png',
        selectedIconPath: './assets/icons/home_selected.png',
      },
      {
        pagePath: 'pages/creator/index',
        text: '创作者',
        iconPath: './assets/icons/like.png',
        selectedIconPath: './assets/icons/like_selected.png',
      },
      {
        pagePath: 'pages/discover/index',
        text: '发现',
        iconPath: './assets/icons/found.png',
        selectedIconPath: './assets/icons/found_selected.png',
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: './assets/icons/my.png',
        selectedIconPath: './assets/icons/my_selected.png',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#7B61FF',
    navigationBarTitleText: '神图壁纸',
    navigationBarTextStyle: 'white',
  },
});
