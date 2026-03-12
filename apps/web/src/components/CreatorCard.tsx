import { Check, ChevronRight, Copy, Download, Image, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Creator } from '@/api/creator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

/**
 * variant:
 *  - "compact"  首页热门创作者，小卡片（头像 + 名字 + 作品数 + code）
 *  - "detail"   创作者广场，大卡片（头像 + 名字 + 简介 + 三项统计 + 箭头）
 */
export interface CreatorCardProps {
  creator: Creator;
  variant?: 'compact' | 'detail';
}

export default function CreatorCard({ creator, variant = 'detail' }: CreatorCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleClick = () => navigate(`/creator/${creator.code}`);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(creator.code).then(() => {
      setCopied(true);
      toast.success('口令已复制');
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (variant === 'compact') {
    return (
      <Card
        className="group overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-gray-100 bg-white/80 backdrop-blur-sm"
        onClick={handleClick}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {/* 头像 */}
            <div className="relative shrink-0">
              <Avatar className="h-14 w-14 border-2 border-purple-100 shadow-md transition-transform group-hover:scale-110">
                <AvatarImage src={creator.avatar} />
                <AvatarFallback className="bg-linear-to-br from-purple-400 to-indigo-500 text-white font-bold text-lg">
                  {creator.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
            </div>

            {/* 信息 */}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                {creator.name}
              </h3>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                {creator.resourceCount} 作品
              </p>
              {/* 口令 */}
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-100">
                <span className="text-[10px] text-purple-400 font-medium">口令</span>
                <span className="text-xs font-bold text-purple-600 tracking-wider">
                  {creator.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="ml-0.5 text-purple-400 hover:text-purple-600 transition-colors"
                  title="复制口令"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // variant === 'detail'
  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-lg hover:border-purple-200"
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          {/* 头像 */}
          <Avatar className="h-16 w-16 border-2 border-purple-100 shrink-0">
            <AvatarImage src={creator.avatar} />
            <AvatarFallback className="bg-linear-to-br from-purple-500 to-indigo-600 text-white text-xl font-bold">
              {creator.name[0]}
            </AvatarFallback>
          </Avatar>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-lg text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                {creator.name}
              </h3>
            </div>
            {/* 口令 */}
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-100 mb-2">
              <span className="text-[10px] text-purple-400 font-medium">口令</span>
              <span className="text-xs font-bold text-purple-600 tracking-wider">
                {creator.code}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="ml-0.5 text-purple-400 hover:text-purple-600 transition-colors"
                title="复制口令"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500 truncate mb-3">
              {creator.description || '暂无简介'}
            </p>
            {/* 三项统计 */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Image className="h-4 w-4 text-purple-500" />
                {creator.resourceCount}
              </span>
              <span className="flex items-center gap-1.5">
                <Download className="h-4 w-4 text-blue-500" />
                {creator.downloadCount}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-pink-500" />
                {creator.followerCount}
              </span>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
