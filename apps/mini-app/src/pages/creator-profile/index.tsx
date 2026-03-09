import { Button, Image, Input, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad, useRouter } from '@tarojs/taro';
import { useState } from 'react';

// 分类选项
const categories = ['全部', '手机壁纸', '头像', '表情', '背景', '动态壁纸', '工具'];

// 模拟作品数据
const mockWorks = [
  { id: 1, title: '张凌赫壁纸', image: '', isTop: true },
  { id: 2, title: '成毅动态背景图', image: '', isTop: true },
  { id: 3, title: '肖战壁纸', image: '', isTop: false },
  { id: 4, title: '白鹿壁纸', image: '', isTop: false },
  { id: 5, title: '王鹤棣壁纸', image: '', isTop: false },
  { id: 6, title: '赵露思壁纸', image: '', isTop: false },
];

// 模拟专辑数据
const mockAlbums = [
  { id: 1, name: '张凌赫壁纸', count: 156, images: [] },
  { id: 2, name: '成毅动态背景图', count: 89, images: [] },
  { id: 3, name: '肖战壁纸', count: 234, images: [] },
  { id: 4, name: '白鹿壁纸', count: 178, images: [] },
];

export default function CreatorProfile() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'works' | 'albums'>('works');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [sortType, setSortType] = useState<'default' | 'date'>('default');

  // 获取路由参数
  const { code } = router.params;

  useLoad(() => {
    console.log('Creator profile page loaded, code:', code);
  });

  // 返回上一页
  const handleBack = () => {
    Taro.navigateBack();
  };

  // 关注/取消关注
  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    Taro.showToast({
      title: isFollowing ? '已取消关注' : '关注成功',
      icon: 'success',
    });
  };

  // 反馈
  const handleFeedback = () => {
    Taro.navigateTo({ url: '/pages/feedback/index' });
  };

  // 分享
  const handleShare = () => {
    // 分享功能
  };

  // 声明
  const handleStatement = () => {
    Taro.showModal({
      title: '声明',
      content: '所有作品均在下方，请仔细查找。超清无水印原图下载为原画超清，感谢支持！',
      showCancel: false,
    });
  };

  // 搜索
  const handleSearch = () => {
    console.log('搜索:', searchKeyword);
  };

  // 查看全部
  const handleViewAll = (albumName: string) => {
    Taro.navigateTo({ url: `/pages/album/detail?name=${albumName}` });
  };
  return (
    <View
      className="min-h-screen flex flex-col text-base"
      style={{
        background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
      }}
    >
      {/* 顶部紫色渐变背景 */}
      <View className="relative px-4 pt-8 pb-2">
        {/* 创作者信息 */}
        <View className="flex items-center gap-4">
          {/* 头像 */}
          <View className="relative">
            <Image className="w-10 h-10 rounded-full border-2 border-zinc-100" src="" />
            <View
              className="absolute bottom-1 -right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center border-2 border-white"
              onClick={handleFollow}
            >
              <Text className="text-white text-base">+</Text>
            </View>
          </View>

          {/* 信息 */}
          <View className="flex-1 flex justify-between items-center">
            <Text className="text-white text-xl font-bold">p345</Text>
            {/* 排序选项（仅在作品tab显示） */}
            {activeTab === 'works' && (
              <View className="absolute right-0 bg-white flex items-center justify-end gap-1 border-b border-gray-100 rounded-l-full p-1 text-xs">
                <View
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border ${
                    sortType === 'default' ? 'border-purple-600 bg-purple-50' : 'border-gray-200'
                  }`}
                  onClick={() => setSortType('default')}
                >
                  <Text className={sortType === 'default' ? 'text-purple-600' : 'text-gray-600'}>
                    ◉
                  </Text>
                  <Text
                    className={`${sortType === 'default' ? 'text-purple-600' : 'text-gray-600'}`}
                  >
                    默认排序
                  </Text>
                </View>
                <View
                  className={`flex items-center gap-1 px-3 py-1 rounded-full border ${
                    sortType === 'date' ? 'border-purple-600 bg-purple-50' : 'border-gray-200'
                  }`}
                  onClick={() => setSortType('date')}
                >
                  <Text className={sortType === 'date' ? 'text-purple-600' : 'text-gray-600'}>
                    ☑
                  </Text>
                  <Text className={`${sortType === 'date' ? 'text-purple-600' : 'text-gray-600'}`}>
                    日期排序
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <Text className="text-white/80 text-xs mt-1">
          所有作品均在下方，请仔细查找。超清无水印原图下载为原画超清，感谢支持！
        </Text>
      </View>

      {/* 内容区域 */}
      <ScrollView className="flex-1 bg-white rounded-t-3xl" scrollY>
        {/* 作品/专辑切换 + 操作按钮 */}
        <View className="px-3 py-2 flex items-center justify-between">
          <View className="flex items-center gap-4">
            <View
              className={`w-20 h-7.5 flex justify-center items-center rounded-full ${
                activeTab === 'works' ? 'bg-purple-600' : 'bg-gray-200'
              }`}
              onClick={() => setActiveTab('works')}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === 'works' ? 'text-white' : 'text-gray-600'
                }`}
              >
                作品(2404)
              </Text>
            </View>
            <View
              className={`w-20 h-7.5 flex justify-center items-center rounded-full ${
                activeTab === 'albums' ? 'bg-purple-600' : 'bg-gray-200'
              }`}
              onClick={() => setActiveTab('albums')}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === 'albums' ? 'text-white' : 'text-gray-600'
                }`}
              >
                专辑(11)
              </Text>
            </View>
          </View>
          <View className="flex items-center gap-3">
            <Text className="text-gray-600 text-2xl" onClick={handleShare}>
              <Text className="iconfont icon-share" />
            </Text>
            <View className="flex items-center gap-0.5" onClick={handleStatement}>
              <Text className="text-gray-400 text-xl">
                <Text className="iconfont icon-info" />
              </Text>
              <Text className="text-gray-800 text-base">声明</Text>
            </View>
          </View>
        </View>
        {/* 分类筛选（仅在作品tab显示） */}
        {activeTab === 'works' && (
          <View className="bg-white px-4 py-3">
            <ScrollView scrollX className="whitespace-nowrap">
              <View className="flex gap-3">
                {categories.map((category) => (
                  <Text
                    key={category}
                    className={`text-sm ${
                      activeCategory === category ? 'text-purple-600 font-bold' : 'text-gray-600'
                    }`}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </Text>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* 搜索框 */}
        <View className="bg-white px-4 my-1">
          <View className="flex items-center gap-2">
            <View className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-2 py-0.5">
              <Text className="text-gray-400 text-base">🔍</Text>
              <Input
                className="flex-1 text-sm"
                placeholder={activeTab === 'works' ? '输入你想搜索的关键词' : '请输入专辑名称'}
                value={searchKeyword}
                onInput={(e) => setSearchKeyword(e.detail.value)}
              />
            </View>
            <View>
              <Button
                type="primary"
                className="rounded-full px-4 py-1 text-sm"
                style={{ background: '#8B5CF6' }}
                onClick={handleSearch}
              >
                搜索
              </Button>
            </View>
          </View>
        </View>
        {/* 作品列表 */}
        {activeTab === 'works' && (
          <View className="px-4 py-4">
            <View className="grid grid-cols-3 gap-3">
              {mockWorks.map((work) => (
                <View key={work.id} className="relative">
                  {work.isTop && (
                    <View className="absolute top-2 left-2 px-2 py-0.5 rounded bg-purple-600 z-10">
                      <Text className="text-white text-xs">置顶</Text>
                    </View>
                  )}
                  <View className="aspect-square rounded-lg bg-gray-200 overflow-hidden">
                    <Image className="w-full h-full" src={work.image} mode="aspectFill" />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 专辑列表 */}
        {activeTab === 'albums' && (
          <View className="px-4 py-4 space-y-6">
            {mockAlbums.map((album) => (
              <View key={album.id}>
                {/* 专辑标题 */}
                <View className="flex items-center justify-between mb-3">
                  <Text className="text-gray-800 font-bold">{album.name}</Text>
                  <Text className="text-gray-400 text-sm" onClick={() => handleViewAll(album.name)}>
                    查看全部 ›
                  </Text>
                </View>

                {/* 专辑图片 */}
                <View className="flex gap-2">
                  {[1, 2, 3, 4].map((_, index) => (
                    <View
                      key={index}
                      className="flex-1 aspect-square rounded-lg bg-gray-200 overflow-hidden relative"
                    >
                      {index === 3 && album.count > 4 && (
                        <View className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Text className="text-white font-bold">+{album.count - 3}</Text>
                        </View>
                      )}
                      <Image className="w-full h-full" src="" mode="aspectFill" />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
