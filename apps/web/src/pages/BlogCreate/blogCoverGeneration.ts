import { markdownToPlainText } from '@/utils/blog';

interface BlogCoverSubjectContextInput {
  title: string;
  excerpt: string;
  content: string;
}

const truncate = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength).trimEnd();
};

export function buildBlogCoverSubjectContext({
  title,
  excerpt,
  content,
}: BlogCoverSubjectContextInput) {
  const sections = [
    ['文章标题', truncate(title, 120)],
    ['文章摘要', truncate(excerpt, 260)],
    ['正文要点', truncate(markdownToPlainText(content), 900)],
  ].filter(([, value]) => value);

  return sections.map(([label, value]) => `${label}：${value}`).join('\n');
}
