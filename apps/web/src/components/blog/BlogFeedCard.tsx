import type { Post } from '@/api/blog';
import { BlogPostCard } from './BlogPostCard';
import { ImageTextPostCard } from './ImageTextPostCard';

interface BlogFeedCardProps {
  post: Post;
}

export function BlogFeedCard({ post }: BlogFeedCardProps) {
  if (post.postType === 'image_text') {
    return <ImageTextPostCard post={post} mode="public" />;
  }
  return <BlogPostCard post={post} mode="public" />;
}
