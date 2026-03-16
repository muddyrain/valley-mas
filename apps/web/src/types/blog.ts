export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  category: string;
  excerpt: string;
  cover?: string;
}

export interface Post extends PostMeta {
  content: string;
}

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

export interface PostsIndex {
  posts: PostMeta[];
}
