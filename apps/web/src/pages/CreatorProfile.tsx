import {
  ArrowLeft,
  Award,
  Download,
  Image as ImageIcon,
  Search,
  Share2,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type Creator,
  followCreator,
  getCreatorByCode,
  getCreatorFollowStatus,
  getCreatorWorks,
  type Resource,
  unfollowCreator,
} from '@/api/creator';
import { favoriteResource, unfavoriteResource } from '@/api/resource';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 分类映射:中文名 -> 后端类型
const categories = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

export default function CreatorProfile() {
  const { code } = useParams<{ code: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [works, setWorks] = useState<Resource[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [worksLoading, setWorksLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('works');
  // 作品收藏状态：key = resourceId, value = boolean
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!code) return;

    const loadCreatorData = async () => {
      try {
        setLoading(true);
        const creatorData = await getCreatorByCode(code);
        setCreator(creatorData);
        setFollowerCount(creatorData.followerCount || 0);

        // 并行加载作品和关注状态
        const [worksData] = await Promise.all([
          getCreatorWorks(creatorData.id),
          // 查询关注状态（接口失败不影响主流程）
          getCreatorFollowStatus(creatorData.id)
            .then((res) => {
              setIsFollowing(res.following);
              setFollowerCount(res.followerCount);
              setIsSelf(res.isSelf);
            })
            .catch(() => {}),
        ]);
        setWorks(worksData.list);

        // 直接从列表响应中读取 isFavorited 字段（服务端对登录用户返回收藏状态）
        const map: Record<string, boolean> = {};
        worksData.list.forEach((w) => {
          map[w.id] = w.isFavorited ?? false;
        });
        setFavoritedMap(map);
      } catch (error) {
        console.error('加载创作者数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCreatorData();
  }, [code]);

  const handleFollow = async () => {
    if (!creator || followLoading) return;

    try {
      setFollowLoading(true);
      if (isFollowing) {
        const res = await unfollowCreator(creator.id);
        setIsFollowing(res.following);
        setFollowerCount((n) => Math.max(0, n - 1));
      } else {
        const res = await followCreator(creator.id);
        setIsFollowing(res.following);
        setFollowerCount((n) => n + 1);
      }
    } catch (error) {
      console.error('关注操作失败:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleFavorite = async (e: React.MouseEvent, work: Resource) => {
    e.stopPropagation();
    const isFav = favoritedMap[work.id] ?? false;
    try {
      if (isFav) {
        await unfavoriteResource(work.id);
        setFavoritedMap((prev) => ({ ...prev, [work.id]: false }));
        toast.success('已取消收藏');
      } else {
        await favoriteResource(work.id);
        setFavoritedMap((prev) => ({ ...prev, [work.id]: true }));
        toast.success('收藏成功');
      }
    } catch {
      toast.error('请先登录后再收藏');
    }
  };

  const handleSearch = async () => {
    if (!creator) return;

    try {
      setWorksLoading(true);
      const params: { keyword?: string; type?: string } = {};
      if (searchKeyword) params.keyword = searchKeyword;
      if (activeCategory) params.type = activeCategory;

      if (activeTab === 'works') {
        const data = await getCreatorWorks(creator.id, params);
        setWorks(data.list);
        const map: Record<string, boolean> = {};
        data.list.forEach((w) => {
          map[w.id] = w.isFavorited ?? false;
        });
        setFavoritedMap(map);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setWorksLoading(false);
    }
  };

  // 切换分类的处理函数
  const handleCategoryChange = async (categoryValue: string) => {
    if (!creator) return;
    setActiveCategory(categoryValue);
    try {
      setWorksLoading(true);
      const params: { keyword?: string; type?: string } = {};
      if (searchKeyword) params.keyword = searchKeyword;
      if (categoryValue) params.type = categoryValue;

      const data = await getCreatorWorks(creator.id, params);
      setWorks(data.list);
      const map: Record<string, boolean> = {};
      data.list.forEach((w) => {
        map[w.id] = w.isFavorited ?? false;
      });
      setFavoritedMap(map);
    } catch (error) {
      console.error('筛选失败:', error);
    } finally {
      setWorksLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
        <div className="bg-linear-to-r from-purple-600 to-purple-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
                <div className="flex gap-6 pt-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">创作者不存在</div>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
      {/* Hero Banner with Glassmorphism */}
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-linear-to-br from-purple-600 via-indigo-600 to-purple-800">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 -left-4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
            <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
            <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="mb-6 text-white/90 hover:text-white hover:bg-white/10 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            {/* Avatar with Glow Effect */}
            <div className="relative group">
              <div className="absolute -inset-2 bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full opacity-75 blur-xl group-hover:opacity-100 transition duration-500" />
              <Avatar className="relative h-32 w-32 md:h-40 md:w-40 border-4 border-white/30 shadow-2xl ring-4 ring-purple-500/30">
                <AvatarImage src={creator.avatar} className="object-cover" />
                <AvatarFallback className="bg-linear-to-br from-purple-400 to-indigo-600 text-white text-4xl md:text-5xl font-bold">
                  {creator.name[0]}
                </AvatarFallback>
              </Avatar>
              {/* Badge */}
              <div className="absolute -bottom-2 -right-2 bg-linear-to-r from-amber-400 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                <Award className="h-3 w-3" />
                认证创作者
              </div>
            </div>

            <div className="flex-1 min-w-0 text-white">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold drop-shadow-lg">
                  {creator.name}
                </h1>
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30 px-3 py-1">
                  <Sparkles className="h-3 w-3 mr-1" />
                  活跃
                </Badge>
              </div>

              <p className="text-purple-100 text-base md:text-lg mb-6 max-w-2xl leading-relaxed drop-shadow">
                {creator.description || '这是一个优秀的内容创作者,分享精美的设计作品'}
              </p>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 hover:bg-white/20 transition-all hover:scale-105">
                  <div className="flex items-center gap-2 text-purple-200 mb-2">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-xs font-medium">作品</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold">{creator.resourceCount}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 hover:bg-white/20 transition-all hover:scale-105">
                  <div className="flex items-center gap-2 text-purple-200 mb-2">
                    <Download className="h-4 w-4" />
                    <span className="text-xs font-medium">下载</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold">{creator.downloadCount}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 hover:bg-white/20 transition-all hover:scale-105">
                  <div className="flex items-center gap-2 text-purple-200 mb-2">
                    <Users className="h-4 w-4" />
                    <span className="text-xs font-medium">粉丝</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold">{followerCount}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {/* 自己不显示关注按钮 */}
                {!isSelf && (
                  <Button
                    onClick={handleFollow}
                    disabled={followLoading}
                    size="lg"
                    variant={isFollowing ? 'ghost' : 'default'}
                    className={`${
                      isFollowing
                        ? 'bg-white/20 hover:bg-white/30 text-white border-2 border-white/50 backdrop-blur-sm'
                        : 'bg-white text-purple-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl hover:scale-105'
                    } font-semibold px-8 transition-all`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="h-5 w-5 mr-2" />
                        已关注
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-5 w-5 mr-2" />
                        关注创作者
                      </>
                    )}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="ghost"
                  className="border-2 border-white/50 text-white hover:bg-white/20 backdrop-blur-sm font-semibold px-6 bg-transparent"
                >
                  <Share2 className="h-5 w-5 mr-2" />
                  分享
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs with Modern Design */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className={'gap-4'}>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2">
            <TabsList className="bg-transparent border-0 gap-6">
              <TabsTrigger
                value="works"
                className="data-[state=active]:bg-linear-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-xl px-6 py-3 font-semibold transition-all data-[state=active]:shadow-lg hover:bg-gray-50"
              >
                <ImageIcon className="h-5 w-5 mr-2" />
                作品集
                <Badge className="ml-2 bg-purple-100 text-purple-600 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {works.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-col flex-1">
            {/* Search and Filter Section - Redesigned */}
            <div className="mb-4 flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 p-6 gap-8 w-full">
              {/* Category Filter */}
              <div className="flex flex-col w-1/2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-linear-to-b from-purple-600 to-indigo-600 rounded-full" />
                    <h3 className="text-lg font-bold text-gray-900">分类筛选</h3>
                  </div>
                  <span className="text-sm text-gray-500">{works.length} 个作品</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <TypeFilterBar
                    options={categories}
                    value={activeCategory}
                    onChange={handleCategoryChange}
                    className="bg-transparent! shadow-none! border-none! p-0!"
                  />
                </div>
              </div>
              {/* Search Box */}
              <div className="flex flex-col w-1/2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-linear-to-b from-purple-600 to-indigo-600 rounded-full" />
                  <h3 className="text-lg font-bold text-gray-900">搜索作品</h3>
                </div>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <Search className="h-5 w-5 text-purple-500" />
                  </div>
                  <Input
                    type="text"
                    placeholder="输入关键词搜索作品..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-14 pr-32 h-14 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-base transition-all"
                  />
                  <Button
                    onClick={handleSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 h-10 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                  >
                    搜索
                  </Button>
                </div>
              </div>
            </div>

            {/* Works Grid */}
            <TabsContent value="works" className="mt-0">
              {worksLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <ResourceCardSkeleton key={i} contentPadding="p-4" />
                  ))}
                </div>
              ) : works.length === 0 ? (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-purple-100 mb-6">
                    <ImageIcon className="h-12 w-12 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无作品</h3>
                  <p className="text-gray-500">该创作者还没有上传任何作品</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {works.map((work) => (
                    <ResourceCard
                      key={work.id}
                      resource={work}
                      isFavorited={favoritedMap[work.id]}
                      onFavorite={handleFavorite}
                      contentPadding="p-4"
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
