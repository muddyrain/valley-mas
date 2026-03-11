import {
  ArrowLeft,
  Folder,
  Image as ImageIcon,
  Search,
  Share2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  type Album,
  type Creator,
  followCreator,
  getCreatorAlbums,
  getCreatorByCode,
  getCreatorWorks,
  type Resource,
  unfollowCreator,
} from '@/api/creator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const categories = ['全部', '壁纸', '头像', '表情包', '背景图'];

export default function CreatorProfile() {
  const { code } = useParams<{ code: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [works, setWorks] = useState<Resource[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('works');

  useEffect(() => {
    if (!code) return;

    const loadCreatorData = async () => {
      try {
        setLoading(true);
        const creatorData = await getCreatorByCode(code);
        setCreator(creatorData);

        const [worksData, albumsData] = await Promise.all([
          getCreatorWorks(creatorData.id),
          getCreatorAlbums(creatorData.id),
        ]);

        setWorks(worksData.list);
        setAlbums(albumsData.list);
      } catch (error) {
        console.error('加载创作者数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCreatorData();
  }, [code]);

  const handleFollow = async () => {
    if (!creator) return;

    try {
      if (isFollowing) {
        await unfollowCreator(creator.id);
        setIsFollowing(false);
      } else {
        await followCreator(creator.id);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('关注操作失败:', error);
    }
  };

  const handleSearch = async () => {
    if (!creator) return;

    try {
      const params: { keyword?: string; category?: string } = {};
      if (searchKeyword) params.keyword = searchKeyword;
      if (activeCategory !== '全部') params.category = activeCategory;

      if (activeTab === 'works') {
        const data = await getCreatorWorks(creator.id, params);
        setWorks(data.list);
      } else {
        const data = await getCreatorAlbums(creator.id, { keyword: searchKeyword });
        setAlbums(data.list);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
        <div className="bg-gradient-to-r from-purple-600 to-purple-800">
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
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-white/30 shadow-xl">
              <AvatarImage src={creator.avatar} />
              <AvatarFallback className="bg-white/20 text-2xl md:text-3xl font-bold">
                {creator.name[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold">{creator.name}</h1>
              <p className="text-purple-100 mt-2 text-sm md:text-base line-clamp-2">
                {creator.description || '暂无简介'}
              </p>

              <div className="flex items-center gap-6 mt-4 text-sm md:text-base">
                <div className="text-center">
                  <span className="font-bold text-xl md:text-2xl">{creator.resourceCount}</span>
                  <span className="text-purple-200 ml-1">作品</span>
                </div>
                <div className="text-center">
                  <span className="font-bold text-xl md:text-2xl">{albums.length}</span>
                  <span className="text-purple-200 ml-1">专辑</span>
                </div>
                <div className="text-center">
                  <span className="font-bold text-xl md:text-2xl">{creator.followerCount}</span>
                  <span className="text-purple-200 ml-1">粉丝</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <Button
                onClick={handleFollow}
                variant={isFollowing ? 'outline' : 'secondary'}
                className={`flex-1 md:flex-none ${
                  isFollowing
                    ? 'border-white text-white hover:bg-white/10'
                    : 'bg-white text-purple-600 hover:bg-gray-100'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" /> 已关注
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" /> 关注
                  </>
                )}
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10 px-3">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white border">
            <TabsTrigger
              value="works"
              className="gap-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700"
            >
              <ImageIcon className="h-4 w-4" />
              作品
            </TabsTrigger>
            <TabsTrigger
              value="albums"
              className="gap-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700"
            >
              <Folder className="h-4 w-4" />
              专辑
            </TabsTrigger>
          </TabsList>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={activeCategory === category ? 'default' : 'outline'}
                  className={`cursor-pointer whitespace-nowrap px-3 py-1.5 ${
                    activeCategory === category
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setActiveCategory(category);
                    handleSearch();
                  }}
                >
                  {category}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="搜索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 w-full sm:w-48"
                />
              </div>
              <Button onClick={handleSearch} variant="outline">
                搜索
              </Button>
            </div>
          </div>

          <TabsContent value="works" className="mt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {works.map((work) => (
                <Card
                  key={work.id}
                  className="group overflow-hidden cursor-pointer transition-all hover:shadow-lg"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                    <img
                      src={work.thumbnailUrl || work.url}
                      alt={work.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-gray-900 truncate">{work.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{work.downloadCount} 次下载</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="albums" className="mt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {albums.map((album) => (
                <Card
                  key={album.id}
                  className="group overflow-hidden cursor-pointer transition-all hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={album.coverUrl}
                      alt={album.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-gray-900 truncate">{album.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{album.resourceCount} 个作品</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
