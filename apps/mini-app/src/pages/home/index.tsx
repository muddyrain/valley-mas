import { Image, Input, ScrollView, Text, View } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';
import './index.scss';

const recommendCreators = [
  { id: 1, avatar: '' },
  { id: 2, avatar: '' },
  { id: 3, avatar: '' },
  { id: 4, avatar: '' },
  { id: 5, avatar: '' },
];

const selectedWallpapers = [
  { id: 1, url: '' },
  { id: 2, url: '' },
  { id: 3, url: '' },
  { id: 4, url: '' },
  { id: 5, url: '' },
  { id: 6, url: '' },
];

export default function Home() {
  useLoad(() => {
    console.log('Home page loaded.');
  });

  return (
    <ScrollView className="home" scrollY>
      {/* Hero Banner */}
      <View className="hero-banner">
        <View className="hero-logo">
          <Text className="hero-logo-text">神图壁纸</Text>
        </View>
        <View className="hero-body">
          <Text className="hero-title text-red-400">神图壁纸</Text>
          <Text className="hero-subtitle">找图就用神图壁纸</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View className="search-wrap">
        <View className="search-bar">
          <Text className="search-icon">🔍</Text>
          <Input
            className="search-input"
            placeholder="请输入创作者口令"
            placeholderClass="search-placeholder"
          />
          <View className="search-btn">
            <Text className="search-btn-text">搜索</Text>
          </View>
        </View>
      </View>

      {/* Recommended Creators */}
      <View className="section">
        <View className="section-header">
          <Text className="section-title">推荐创作者</Text>
        </View>
        <ScrollView className="creators-scroll" scrollX enableFlex>
          {recommendCreators.map((item) => (
            <View key={item.id} className="creator-avatar-item">
              <View className="avatar-circle">
                <Image className="avatar-img" src={item.avatar} />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Selected Wallpapers */}
      <View className="section">
        <View className="section-header">
          <Text className="section-title">壁纸精选</Text>
        </View>
        <View className="wallpaper-grid">
          {selectedWallpapers.map((item) => (
            <View key={item.id} className="wallpaper-item">
              <Image className="wallpaper-img" src={item.url} mode="aspectFill" />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
