import { Text, View } from '@tarojs/components';
import type { FC } from 'react';
import { PAGE_TITLE } from '@/constant';

export const Banner: FC = () => {
  return (
    <View className="relative px-4 pt-12 pb-6">
      {/* 主标题区域 */}
      <View className="mt-8 flex flex-col items-center">
        {/* 主标题 */}
        <View className="relative">
          <Text className="text-4xl font-black text-white tracking-wider drop-shadow-lg">
            {PAGE_TITLE}
          </Text>
          {/* 装饰效果 */}
          <View className="absolute -top-2 -right-4 w-6 h-6 rounded-full bg-yellow-400/80" />
        </View>

        {/* 副标题 */}
        <Text className="mt-2 text-white/90 text-base tracking-widest">找图就用{PAGE_TITLE}</Text>

        {/* 装饰元素 - 模拟 3D 插画效果 */}
        <View className="mt-6 w-full h-40 relative">
          {/* 装饰圆环 */}
          <View className="absolute top-4 left-8 w-16 h-16 rounded-full border-4 border-yellow-400/60" />
          <View className="absolute bottom-8 right-12 w-12 h-12 rounded-full bg-pink-400/40" />
          <View className="absolute top-8 right-20 w-8 h-8 rounded-full bg-blue-400/50" />

          {/* 中心插画区域 */}
          <View className="absolute inset-0 flex items-center justify-center">
            <View className="w-32 h-32 rounded-2xl bg-linear-to-br from-pink-400/30 to-purple-500/30 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Text className="text-6xl">🎨</Text>
            </View>
          </View>

          {/* 漂浮装饰 */}
          <View className="absolute top-2 right-4 text-2xl">✨</View>
          <View className="absolute bottom-4 left-4 text-xl">🌟</View>
          <View className="absolute top-1/2 right-2 text-lg">💫</View>
        </View>
      </View>
    </View>
  );
};
