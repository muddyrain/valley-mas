import { Avatar, Button, Cell } from '@nutui/nutui-react-taro';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { PAGE_TITLE } from '@/constant';

// 菜单项配置
const menuItems = [
  { id: 1, label: '成为创作者', icon: '👤' },
  { id: 2, label: '我的订单', icon: '📋' },
  { id: 3, label: '联系客服', icon: '💬' },
  { id: 4, label: '下载记录', icon: '📥' },
  { id: 5, label: '浏览历史', icon: '🕐' },
  { id: 6, label: '常见问题', icon: '❓' },
  { id: 7, label: '关于我们', icon: 'ℹ️' },
  { id: 8, label: '清理缓存', icon: '🗑️' },
];

export default function Mine() {
  const [userInfo] = useState({
    nickname: '匿名用户',
    avatar: '',
    isVip: false,
    vipExpireTime: '',
  });

  useLoad(() => {
    console.log('Mine page loaded.');
  });

  // 处理菜单点击
  const handleMenuClick = (item: (typeof menuItems)[0]) => {
    console.log('点击菜单:', item.label);
    switch (item.id) {
      case 1:
        Taro.navigateTo({ url: '/pages/creator/apply' });
        break;
      case 2:
        Taro.navigateTo({ url: '/pages/order/list' });
        break;
      case 3:
        {
          console.log('联系客服');
        }
        break;
      case 4:
        Taro.navigateTo({ url: '/pages/download/history' });
        break;
      case 5:
        Taro.navigateTo({ url: '/pages/history/browse' });
        break;
      case 6:
        Taro.navigateTo({ url: '/pages/faq/index' });
        break;
      case 7:
        Taro.navigateTo({ url: '/pages/about/index' });
        break;
      case 8:
        Taro.showModal({
          title: '提示',
          content: '确定要清理缓存吗？',
          success: (res) => {
            if (res.confirm) {
              Taro.showToast({ title: '清理成功', icon: 'success' });
            }
          },
        });
        break;
    }
  };

  // 开通 VIP
  const handleOpenVip = () => {
    Taro.navigateTo({ url: '/pages/vip/index' });
  };

  // 分享好友
  const handleShare = () => {
    // 分享功能
  };

  // 反馈
  const handleFeedback = () => {
    Taro.navigateTo({ url: '/pages/feedback/index' });
  };

  return (
    <ScrollView className="min-h-screen bg-gray-50" scrollY>
      {/* 顶部紫色渐变背景区域 */}
      <View
        className="relative px-4 pt-12 pb-20"
        style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
        }}
      >
        {/* 用户信息区域 */}
        <View className="flex items-center gap-4">
          {/* 头像 */}
          <View className="relative">
            {userInfo.avatar ? (
              <Avatar size="large" src={userInfo.avatar} />
            ) : (
              <View className="w-16 h-16 rounded-full bg-white/20 flex flex-col items-center justify-center border-2 border-white/30">
                <Text className="text-white text-xs font-bold">神图</Text>
                <Text className="text-white/80 text-[10px]">壁纸</Text>
              </View>
            )}
          </View>

          {/* 用户信息 */}
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">{userInfo.nickname}</Text>
            <Text className="text-white/80 text-sm mt-1">
              {userInfo.isVip
                ? `VIP 到期时间：${userInfo.vipExpireTime}`
                : '未开通（开通会员享受更多权益）'}
            </Text>
          </View>
        </View>
      </View>

      {/* VIP 会员卡片 */}
      <View className="px-4 -mt-10 relative z-10">
        <View
          className="rounded-2xl p-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}
          onClick={handleOpenVip}
        >
          <View>
            <View className="flex items-center gap-2 mb-1">
              <Text className="text-yellow-400 text-base font-bold">尊享会员</Text>
              <View className="px-1 h-4 rounded bg-yellow-400 flex items-center">
                <Text className="text-xs leading-0.5 font-bold text-gray-900">VIP</Text>
              </View>
            </View>
            <Text className="text-yellow-400/70 text-sm">尊享各种特权和福利</Text>
          </View>

          <Button
            type="primary"
            size="small"
            className="rounded-full px-4"
            style={{ background: '#F0C060', color: '#1a1a2e' }}
          >
            立即开通 →
          </Button>
        </View>
      </View>

      {/* 快捷入口区域 */}
      <View className="px-4 mt-4">
        <View className="bg-white rounded-2xl flex overflow-hidden">
          {/* 关注的人 */}
          <View
            className="flex-1 flex items-center justify-between p-4"
            onClick={() => Taro.navigateTo({ url: '/pages/follow/index' })}
          >
            <Text className="text-gray-800 font-medium">关注的人</Text>
            <View className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Text className="text-lg">👤</Text>
            </View>
          </View>

          {/* 分隔线 */}
          <View className="w-px bg-gray-100 my-3" />

          {/* 收藏作品 */}
          <View
            className="flex-1 flex items-center justify-between p-4"
            onClick={() => Taro.navigateTo({ url: '/pages/favorite/index' })}
          >
            <Text className="text-gray-800 font-medium">收藏作品</Text>
            <View className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
              <Text className="text-lg">🖼</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 功能菜单列表 */}
      <View className="px-4 mt-4">
        <View className="bg-white rounded-2xl overflow-hidden">
          {menuItems.map((item, index) => (
            <Cell
              key={item.id}
              title={
                <View className="flex items-center gap-3">
                  <Text className="text-lg">{item.icon}</Text>
                  <Text className="text-gray-800">{item.label}</Text>
                </View>
              }
              onClick={() => handleMenuClick(item)}
              className={index < menuItems.length - 1 ? 'border-b border-gray-100' : ''}
            />
          ))}
        </View>
      </View>

      {/* 分享好友 */}
      <View className="px-4 mt-4">
        <View className="bg-white rounded-2xl overflow-hidden">
          <Cell
            title={
              <View className="flex items-center gap-3">
                <Text className="text-lg">📤</Text>
                <Text className="text-gray-800">分享好友</Text>
              </View>
            }
            onClick={handleShare}
          />
        </View>
      </View>

      {/* 底部信息 */}
      <View className="flex items-center justify-center gap-3 py-8 px-4">
        <View className="h-px flex-1 bg-gray-300" />
        <Text className="text-gray-400 text-sm">找图就用{PAGE_TITLE}</Text>
        <View className="h-px flex-1 bg-gray-300" />
      </View>
    </ScrollView>
  );
}
