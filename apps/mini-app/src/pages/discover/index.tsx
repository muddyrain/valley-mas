import { ScrollView, View, Text, Image } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

const wallpapers = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, url: '' }))

export default function Discover() {
  useLoad(() => {
    console.log('Discover page loaded.')
  })

  return (
    <ScrollView className='discover-page' scrollY>
      <View className='discover-grid'>
        {wallpapers.map(item => (
          <View key={item.id} className='discover-item'>
            <Image className='discover-img' src={item.url} mode='aspectFill' />
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
