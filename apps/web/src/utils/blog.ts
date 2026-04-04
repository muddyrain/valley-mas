import { marked } from 'marked';
import type { Post, PostDetail } from '@/api/blog';

// HTML 转义函数
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 简单的代码高亮函数
function highlightCode(code: string): string {
  // 先转义 HTML，防止代码中的标签被解析
  const escaped = escapeHtml(code);

  // 基础语法高亮 - 使用占位符方式避免嵌套替换问题
  const tokens: { placeholder: string; html: string }[] = [];
  let tokenIndex = 0;

  // 1. 先提取并替换注释
  let processed = escaped.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, (match) => {
    const placeholder = `___TOKEN_${tokenIndex++}___`;
    tokens.push({
      placeholder,
      html: `<span style="color:#6c7086">${match}</span>`,
    });
    return placeholder;
  });

  // 2. 提取并替换字符串 (双引号)
  processed = processed.replace(/(&quot;.*?&quot;)/g, (match) => {
    const placeholder = `___TOKEN_${tokenIndex++}___`;
    tokens.push({
      placeholder,
      html: `<span style="color:#a6e3a1">${match}</span>`,
    });
    return placeholder;
  });

  // 3. 提取并替换字符串 (单引号)
  processed = processed.replace(/(&#039;.*?&#039;)/g, (match) => {
    const placeholder = `___TOKEN_${tokenIndex++}___`;
    tokens.push({
      placeholder,
      html: `<span style="color:#a6e3a1">${match}</span>`,
    });
    return placeholder;
  });

  // 4. 关键字高亮
  processed = processed.replace(
    /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|try|catch)\b/g,
    '<span style="color:#cba6f7">$1</span>',
  );

  // 5. 函数名高亮
  processed = processed.replace(
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
    '<span style="color:#89b4fa">$1</span>',
  );

  // 6. 数字高亮
  processed = processed.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color:#fab387">$1</span>');

  // 7. 还原所有占位符
  for (const token of tokens.reverse()) {
    processed = processed.replace(token.placeholder, token.html);
  }

  return processed;
}

const renderer = new marked.Renderer();

// 自定义代码块渲染 - 适配 marked v15+ API
renderer.code = (code: { text: string; lang?: string }) => {
  const codeText = typeof code === 'string' ? code : code.text || '';
  const language = typeof code === 'string' ? '' : code.lang || 'text';
  const highlighted = highlightCode(codeText);
  return `<pre><code class="language-${language}">${highlighted}</code></pre>`;
};

marked.setOptions({
  gfm: true,
  breaks: true,
});

marked.use({ renderer });

// 渲染 Markdown 为 HTML
export function renderMarkdown(content: string): string {
  return marked.parse(content) as string;
}

export function createHeadingId(text: string): string {
  const normalized = String(text)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'heading';
}

function getHeadingToc(content: string): TocItem[] {
  const tokens = marked.lexer(content || '');
  const slugCounter = new Map<string, number>();
  const result: TocItem[] = [];

  for (const token of tokens) {
    if (token.type !== 'heading') continue;
    const headingToken = token as { depth?: number; text?: string };
    const level = headingToken.depth ?? 1;
    const text = String(headingToken.text || '').trim();
    if (!text) continue;

    const base = createHeadingId(text);
    const count = (slugCounter.get(base) || 0) + 1;
    slugCounter.set(base, count);
    const uniqueId = count === 1 ? base : `${base}-${count}`;

    result.push({ level, text, id: uniqueId });
  }

  return result;
}

export function withHeadingAnchors(html: string, toc: TocItem[]): string {
  let index = 0;
  return html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g, (_, level, attrs, inner) => {
    const current = toc[index];
    const fallbackId = `heading-${index + 1}`;
    const id = current?.id || fallbackId;
    index += 1;

    const cleanAttrs = String(attrs || '').replace(/\sid="[^"]*"/g, '');
    return `<h${level}${cleanAttrs} id="${id}">${String(inner)}</h${level}>`;
  });
}

export function renderMarkdownWithAnchors(content: string): string {
  const toc = getHeadingToc(content);
  return withHeadingAnchors(renderMarkdown(content), toc);
}

export function markdownToPlainText(content: string): string {
  if (!content) return '';

  return String(content)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function createPlainTextExcerpt(content: string, maxLength = 180): string {
  const plainText = markdownToPlainText(content);
  if (!plainText) return '';
  if (plainText.length <= maxLength) return plainText;
  return `${plainText.slice(0, maxLength).trimEnd()}...`;
}

// 从 Markdown 内容提取目录
export interface TocItem {
  level: number;
  text: string;
  id: string;
}

export function extractToc(content: string): TocItem[] {
  return getHeadingToc(content);
}

// 格式化日期
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// 从后端 Post 数据转换为前端需要的格式
export function convertPost(post: Post) {
  return {
    ...post,
    formattedDate: formatDate(post.publishedAt || post.createdAt),
  };
}

// 从后端 PostDetail 数据转换为前端需要的格式
export function convertPostDetail(post: PostDetail) {
  return {
    ...post,
    formattedDate: formatDate(post.publishedAt || post.createdAt),
  };
}

// 获取所有标签（从文章列表中提取）
export function getAllTagsFromPosts(posts: Post[]): { name: string; count: number }[] {
  const tagMap = new Map<string, number>();

  for (const post of posts) {
    if (post.tags) {
      for (const tag of post.tags) {
        tagMap.set(tag.name, (tagMap.get(tag.name) || 0) + 1);
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// 获取所有分类（从文章列表中提取）
export function getAllCategoriesFromPosts(posts: Post[]): { name: string; count: number }[] {
  const categoryMap = new Map<string, number>();

  for (const post of posts) {
    if (post.category) {
      categoryMap.set(post.category.name, (categoryMap.get(post.category.name) || 0) + 1);
    }
  }

  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// 按标签筛选文章
export function filterPostsByTag(posts: Post[], tagSlug: string): Post[] {
  return posts.filter((post) => post.tags?.some((tag) => tag.slug === tagSlug));
}

// 按分类筛选文章
export function filterPostsByCategory(posts: Post[], categorySlug: string): Post[] {
  return posts.filter((post) => post.category?.slug === categorySlug);
}

// 按关键词搜索文章
export function searchPosts(posts: Post[], keyword: string): Post[] {
  const lowerKeyword = keyword.toLowerCase();
  return posts.filter(
    (post) =>
      post.title.toLowerCase().includes(lowerKeyword) ||
      post.excerpt.toLowerCase().includes(lowerKeyword),
  );
}
