import { Button, Image, Input, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad, useReady } from '@tarojs/taro';
import { useEffect, useMemo, useState } from 'react';
import { creatorApi } from '@/api';
import { Banner } from './Banner';

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
  type: 'avatar' | 'wallpaper';
  downloadCount: number;
  creatorName?: string;
}

export default function Home() {
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore] = useState(true);
  const [windowWidth, setWindowWidth] = useState(375); // 默认值

  // 获取屏幕宽度
  useReady(() => {
    const systemInfo = Taro.getSystemInfoSync();
    setWindowWidth(systemInfo.windowWidth || 375);
  });

  // Mock 数据 - 推荐创作者
  const [hotCreators, setHotCreators] = useState<Creator[]>([]);

  // Mock 数据 - 壁纸精选
  const [resources] = useState<Resource[]>([
    {
      id: '1',
      title: '星空夜景',
      url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=600&fit=crop',
      type: 'wallpaper',
      downloadCount: 1520,
      creatorName: '壁纸大师',
    },
    {
      id: '2',
      title: '极光之美',
      url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=500&fit=crop',
      type: 'wallpaper',
      downloadCount: 2340,
      creatorName: '设计师小王',
    },
    {
      id: '3',
      title: '梦幻云海',
      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=700&fit=crop',
      type: 'wallpaper',
      downloadCount: 1890,
      creatorName: '像素艺术家',
    },
    {
      id: '4',
      title: '城市夜景',
      url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&h=600&fit=crop',
      type: 'wallpaper',
      downloadCount: 3120,
      creatorName: '二次元画师',
    },
    {
      id: '5',
      title: '山水风光',
      url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=500&fit=crop',
      type: 'wallpaper',
      downloadCount: 980,
      creatorName: '美图工坊',
    },
    {
      id: '6',
      title: '日落余晖',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=650&fit=crop',
      type: 'wallpaper',
      downloadCount: 2560,
      creatorName: '壁纸大师',
    },
  ]);

  useLoad(() => {
    console.log('Home page loaded.');
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
    setTimeout(() => {
      Taro.hideLoading();
      Taro.navigateTo({
        url: `/pages/creator-profile/index?code=${searchCode}`,
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
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  // 根据屏幕宽度计算列数
  const columns = useMemo(() => {
    if (windowWidth < 768) return 2; // 小屏2列
    if (windowWidth < 1200) return 3; // 中屏3列
    return 4; // 大屏4列
  }, [windowWidth]);

  // 根据图片 ID 返回不同高度，模拟瀑布流效果
  const getImageHeight = (id: string) => {
    const heights: Record<string, number> = {
      '1': 280,
      '2': 200,
      '3': 320,
      '4': 240,
      '5': 180,
      '6': 300,
    };
    return heights[id] || 220;
  };

  // 瀑布流布局算法 - Masonry
  const waterfallColumns = useMemo(() => {
    // 初始化列数组
    const cols: Resource[][] = Array.from({ length: columns }, () => []);
    // 初始化每列高度
    const colHeights = new Array(columns).fill(0);

    // 遍历所有资源，分配到最短的列
    resources.forEach((resource) => {
      // 找到最短的列索引
      const minHeight = Math.min(...colHeights);
      const minIndex = colHeights.indexOf(minHeight);

      // 将资源添加到该列
      cols[minIndex].push(resource);
      // 更新该列高度
      colHeights[minIndex] += getImageHeight(resource.id) + 8; // 8px 为间距
    });

    return cols;
  }, [resources, columns]);

  useEffect(() => {
    creatorApi.getHotCreators().then((res) => {
      console.log(res.list);
      setHotCreators(res.list || []);
    });
  }, []);

  // 渲染分割线装饰
  const renderDivider = (text: string) => (
    <View className="flex items-center justify-center py-4">
      <View className="h-px w-12 bg-white/30" />
      <Text className="mx-4 text-white/80 text-sm">{text}</Text>
      <View className="h-px w-12 bg-white/30" />
    </View>
  );

  return (
    <ScrollView
      className="min-h-screen"
      style={{ background: 'linear-gradient(180deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)' }}
      scrollY
      onScrollToLower={loadMore}
      lowerThreshold={100}
    >
      {/* 顶部 Banner 区域 */}
      <Banner />

      {/* 搜索框区域 */}
      <View className="px-4 pb-4">
        <View className="bg-white rounded-2xl px-4 py-3 shadow-lg border-indigo-300 border-4">
          <div className="flex items-center">
            <Text className="text-gray-400 text-xl mr-2">🔍</Text>
            <Input
              placeholder="请输入创作者口令"
              className="appearance-none flex-1 text-lg"
              value={searchCode}
              onInput={(e) => {
                setSearchCode(e.detail.value);
              }}
              onConfirm={handleSearch}
            />
            <View>
              <Button
                type="primary"
                className="rounded-full px-3 py-1 text-sm"
                style={{ background: 'var(--color-primary)' }}
                onClick={handleSearch}
              >
                搜索
              </Button>
            </View>
          </div>
        </View>
      </View>

      {/* 推荐创作者 */}
      <View>
        {renderDivider('推荐创作者')}
        <ScrollView className="whitespace-nowrap px-4" scrollX showScrollbar={false}>
          <View className="flex pb-2">
            {hotCreators.map((creator) => (
              <View
                key={creator.id}
                className="inline-flex flex-col items-center mr-5 last:mr-0"
                onClick={() => viewCreator(creator)}
              >
                {creator.avatar ? (
                  <Image
                    src={creator.avatar}
                    className="w-12 h-12 rounded-full border-2 border-solid border-white/50"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                    {creator.name?.[0] || '?'}
                  </div>
                )}
                <Text className="text-xs text-white/90 mt-2 truncate max-w-16 text-center">
                  {creator.name}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 壁纸精选 */}
      <View className="px-4 pb-8">
        {renderDivider('壁纸精选')}

        {/* 瀑布流网格 */}
        <View className="flex -mx-1">
          {waterfallColumns.map((column, colIndex) => (
            <View key={colIndex} className="flex-1 px-1">
              {column.map((resource) => (
                <View key={resource.id} className="mb-2" onClick={() => viewResource(resource)}>
                  <View className="rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm">
                    <Image
                      src={resource.url}
                      className="w-full"
                      style={{ height: `${getImageHeight(resource.id)}px` }}
                      mode="aspectFill"
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* 加载状态 */}
        {loading && (
          <View className="flex justify-center py-4">
            <Text className="text-white/60 text-sm">加载中...</Text>
          </View>
        )}

        {!hasMore && resources.length > 0 && (
          <View className="flex justify-center py-4">
            <Text className="text-white/40 text-sm">没有更多了</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
