export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/creator/index',
    'pages/discover/index',
    'pages/mine/index',
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
      },
      {
        pagePath: 'pages/creator/index',
        text: '创作者',
      },
      {
        pagePath: 'pages/discover/index',
        text: '发现',
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#7B61FF',
    navigationBarTitleText: '神图壁纸',
    navigationBarTextStyle: 'white',
  },
})
