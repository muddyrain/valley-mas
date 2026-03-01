import { ScrollView, View, Text, Image } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

const creators = [
  {
    id: 1,
    avatar: '',
    name: '鸣鸣',
    workCount: 8,
    works: ['', '', ''],
  },
  {
    id: 2,
    avatar: '',
    name: '樱桃小完筷子',
    workCount: 9,
    works: ['', '', ''],
  },
  {
    id: 3,
    avatar: '',
    name: '第几页是盛夏',
    workCount: 12,
    works: ['', '', ''],
  },
]

export default function Creator() {
  useLoad(() => {
    console.log('Creator page loaded.')
  })

  return (
    <ScrollView className='creator-page' scrollY>
      {/* Join Banner */}
      <View className='join-banner'>
        <View className='join-banner-text'>
          <Text className='join-title'>欢迎创作者入驻神图壁纸</Text>
          <View className='join-btn'>
            <Text className='join-btn-text'>点击进入</Text>
          </View>
        </View>
        <View className='join-coins'>
          <Text className='coin-icon'>🪙</Text>
          <Text className='coin-icon small'>🪙</Text>
        </View>
      </View>

      {/* Creator List */}
      {creators.map(creator => (
        <View key={creator.id} className='creator-card'>
          <View className='creator-header'>
            <View className='creator-info'>
              <View className='creator-avatar'>
                <Image className='avatar-img' src={creator.avatar} />
              </View>
              <View className='creator-meta'>
                <Text className='creator-name'>{creator.name}</Text>
                <Text className='creator-count'>作品数量：{creator.workCount}</Text>
              </View>
            </View>
            <View className='view-all-btn'>
              <Text className='view-all-text'>查看全部 &gt;</Text>
            </View>
          </View>
          <View className='creator-works'>
            {creator.works.map((url, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <View key={i} className='work-item'>
                <Image className='work-img' src={url} mode='aspectFill' />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
