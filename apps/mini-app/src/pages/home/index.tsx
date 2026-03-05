import { Avatar, Card, Divider, Empty, Loading, SearchBar } from '@nutui/nutui-react-taro';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';

// 类型定义
interface Creator {
  id: string;
  name: string;
  avatar: string;
  resourceCount: number;
  downloadCount: number;
}

interface Resource {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  type: 'avatar' | 'wallpaper';
  downloadCount: number;
  creatorName?: string;
}

export default function Home() {
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore] = useState(true); // 后续会使用 setHasMore

  // Mock 数据 - 后续替换为真实 API
  const [hotCreators] = useState<Creator[]>([
    {
      id: '1',
      name: '壁纸大师',
      avatar: 'https://via.placeholder.com/120/7B61FF/FFFFFF?text=壁纸大师',
      resourceCount: 328,
      downloadCount: 12580,
    },
    {
      id: '2',
      name: '设计师小王',
      avatar: 'https://via.placeholder.com/120/FF6B9D/FFFFFF?text=小王',
      resourceCount: 156,
      downloadCount: 8920,
    },
    {
      id: '3',
      name: '像素艺术家',
      avatar: 'https://via.placeholder.com/120/4ECDC4/FFFFFF?text=像素',
      resourceCount: 234,
      downloadCount: 10245,
    },
    {
      id: '4',
      name: '美图工坊',
      avatar: 'https://via.placeholder.com/120/FFD93D/FFFFFF?text=美图',
      resourceCount: 412,
      downloadCount: 15680,
    },
    {
      id: '5',
      name: '二次元画师',
      avatar: 'https://via.placeholder.com/120/6BCF7F/FFFFFF?text=二次元',
      resourceCount: 189,
      downloadCount: 9530,
    },
  ]);

  const [resources] = useState<Resource[]>([
    {
      id: '1',
      title: '星空夜景',
      url: 'https://via.placeholder.com/600x800/1A1A2E/FFFFFF?text=星空',
      type: 'wallpaper',
      downloadCount: 1520,
      creatorName: '壁纸大师',
    },
    {
      id: '2',
      title: '可爱头像',
      url: 'https://via.placeholder.com/600x600/FF6B9D/FFFFFF?text=头像',
      type: 'avatar',
      downloadCount: 2340,
      creatorName: '设计师小王',
    },
    {
      id: '3',
      title: '极简风景',
      url: 'https://via.placeholder.com/600x900/4ECDC4/FFFFFF?text=风景',
      type: 'wallpaper',
      downloadCount: 1890,
      creatorName: '像素艺术家',
    },
    {
      id: '4',
      title: '动漫壁纸',
      url: 'https://via.placeholder.com/600x800/FFD93D/FFFFFF?text=动漫',
      type: 'wallpaper',
      downloadCount: 3120,
      creatorName: '二次元画师',
    },
    {
      id: '5',
      title: '唯美插画',
      url: 'https://via.placeholder.com/600x600/6BCF7F/FFFFFF?text=插画',
      type: 'avatar',
      downloadCount: 980,
      creatorName: '美图工坊',
    },
    {
      id: '6',
      title: '梦幻背景',
      url: 'https://via.placeholder.com/600x1000/7B61FF/FFFFFF?text=梦幻',
      type: 'wallpaper',
      downloadCount: 2560,
      creatorName: '壁纸大师',
    },
  ]);

  useLoad(() => {
    console.log('Home page loaded.');
    // TODO: 加载热门创作者和资源
  });

  // 搜索创作者口令
  const handleSearch = () => {
    if (!searchCode.trim()) {
      Taro.showToast({
        title: '请输入口令',
        icon: 'none',
      });
      return;
    }

    Taro.showLoading({ title: '搜索中...' });

    // TODO: 调用 API 验证口令
    setTimeout(() => {
      Taro.hideLoading();
      // 跳转到创作者空间页面
      Taro.navigateTo({
        url: `/pages/creator/space?code=${searchCode}`,
      });
    }, 1000);
  };

  // 查看创作者
  const viewCreator = (creator: Creator) => {
    Taro.navigateTo({
      url: `/pages/creator/detail?id=${creator.id}`,
    });
  };

  // 查看资源详情
  const viewResource = (resource: Resource) => {
    Taro.navigateTo({
      url: `/pages/resource/detail?id=${resource.id}`,
    });
  };

  // 加载更多
  const loadMore = () => {
    if (loading || !hasMore) return;

    setLoading(true);
    // TODO: 调用 API 加载更多资源
    setTimeout(() => {
      setLoading(false);
      // setHasMore(false); // 没有更多数据时
    }, 1000);
  };

  return (
    <ScrollView
      className="min-h-screen bg-gray-50"
      scrollY
      onScrollToLower={loadMore}
      lowerThreshold={100}
    >
      {/* 顶部搜索栏 - 使用 NutUI SearchBar */}
      <View className="bg-white px-4 py-3 shadow-sm">
        <SearchBar
          placeholder="输入创作者口令，发现精彩内容"
          value={searchCode}
          onChange={(val) => setSearchCode(val)}
          onSearch={handleSearch}
          onClear={() => setSearchCode('')}
        />
      </View>

      {/* 热门创作者 - 使用 NutUI Avatar */}
      <View className="bg-white mt-2 px-4 py-4">
        <View className="flex items-center justify-between mb-3">
          <Text className="text-lg font-bold">🔥 热门创作者</Text>
          <Text className="text-xs text-gray-400">查看更多 →</Text>
        </View>

        <ScrollView className="whitespace-nowrap" scrollX showScrollbar={false}>
          <View className="flex">
            {hotCreators.map((creator) => (
              <View
                key={creator.id}
                className="inline-block mr-4 last:mr-0"
                onClick={() => viewCreator(creator)}
              >
                <View className="flex flex-col items-center w-20">
                  <Avatar size="large" src={creator.avatar} />
                  <Text className="text-xs font-medium truncate w-full text-center mt-2 mb-1">
                    {creator.name}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {((downloadCount: number): string => {
                      if (downloadCount >= 10000) {
                        return `${(downloadCount / 10000).toFixed(1)}w`;
                      }
                      return downloadCount.toString();
                    })(creator.downloadCount)} 下载
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <Divider />

      {/* 精选资源 - 使用 NutUI Card */}
      <View className="px-4 py-4">
        <View className="flex items-center justify-between mb-3">
          <Text className="text-lg font-bold">✨ 精选资源</Text>
          <Text className="text-xs text-gray-400">筛选 🔽</Text>
        </View>

        {/* 两列瀑布流 */}
        {resources.length === 0 ? (
          <Empty description="暂无资源" />
        ) : (
          <View className="flex flex-wrap -mx-2">
            {resources.map((resource) => (
              <View
                key={resource.id}
                className="w-1/2 px-2 mb-4"
                onClick={() => viewResource(resource)}
              >
                <Card>
                  <Image src={resource.url} className="w-full h-48 bg-gray-200" mode="aspectFill" />
                  <View className="pt-2">
                    <Text className="text-sm font-medium mb-1 truncate block">
                      {resource.title}
                    </Text>
                    <View className="flex items-center justify-between">
                      <Text className="text-xs text-gray-400 truncate flex-1">
                        {resource.creatorName}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        📥 {((downloadCount: number): string => {
                          if (downloadCount >= 10000) {
                            return `${(downloadCount / 10000).toFixed(1)}w`;
                          }
                          return downloadCount.toString();
                        })(resource.downloadCount)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </View>
            ))}
          </View>
        )}

        {/* 加载状态 - 使用 NutUI Loading */}
        {loading && (
          <View className="flex justify-center py-4">
            <Loading />
          </View>
        )}

        {!hasMore && resources.length > 0 && (
          <View className="flex justify-center py-4">
            <Text className="text-sm text-gray-400">没有更多了</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
