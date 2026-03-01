import { ScrollView, View, Text, Image } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

const menuItems = [
  { id: 1, label: '成为创作者' },
  { id: 2, label: '我的订单' },
  { id: 3, label: '联系客服' },
  { id: 4, label: '下载记录' },
  { id: 5, label: '浏览历史' },
  { id: 6, label: '常见问题' },
  { id: 7, label: '关于我们' },
]

export default function Mine() {
  useLoad(() => {
    console.log('Mine page loaded.')
  })

  return (
    <ScrollView className='mine-page' scrollY>
      {/* User Info Header */}
      <View className='user-header'>
        <View className='user-info'>
          <View className='user-avatar'>
            <Image className='avatar-img' src='' />
            <Text className='avatar-placeholder'>神图壁纸</Text>
          </View>
          <View className='user-meta'>
            <Text className='username'>用户73c1684c</Text>
            <Text className='user-status'>未开通（开通会员享受更多权益）</Text>
          </View>
        </View>
        <View className='logout-btn'>
          <Text className='logout-text'>退出登录</Text>
        </View>
      </View>

      {/* VIP Banner */}
      <View className='vip-banner'>
        <View className='vip-info'>
          <View className='vip-title-row'>
            <Text className='vip-title'>尊享会员</Text>
            <Text className='vip-badge'>VIP</Text>
          </View>
          <Text className='vip-desc'>尊享各种特权和福利</Text>
        </View>
        <View className='vip-open-btn'>
          <Text className='vip-open-text'>立即开通 →</Text>
        </View>
      </View>

      {/* Quick Access */}
      <View className='quick-access'>
        <View className='quick-item'>
          <View className='quick-icon'>
            <Text className='icon-emoji'>👤</Text>
          </View>
          <Text className='quick-label'>关注的人</Text>
        </View>
        <View className='quick-divider' />
        <View className='quick-item'>
          <View className='quick-icon'>
            <Text className='icon-emoji'>🖼</Text>
          </View>
          <Text className='quick-label'>收藏作品</Text>
        </View>
      </View>

      {/* Menu List */}
      <View className='menu-list'>
        {menuItems.map((item, index) => (
          <View key={item.id} className={`menu-item${index < menuItems.length - 1 ? ' with-border' : ''}`}>
            <Text className='menu-label'>{item.label}</Text>
            <Text className='menu-arrow'>&gt;</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
