import { describe, expect, it } from 'vitest';
import { buildBlogCoverSubjectContext } from './blogCoverGeneration';

describe('buildBlogCoverSubjectContext', () => {
  it('uses article content as the cover subject instead of a fixed genre prompt', () => {
    const brief = buildBlogCoverSubjectContext({
      title: '元数据标记',
      excerpt: '介绍 tags 和 token 的使用',
      content: '# 元数据标记\n\n```ts\nconst hidden = true\n```\n正文讲解 React 元数据。',
    });

    expect(brief).toContain('元数据标记');
    expect(brief).toContain('介绍 tags 和 token 的使用');
    expect(brief).toContain('正文讲解 React 元数据');
    expect(brief).not.toContain('const hidden');
    expect(brief).not.toContain('原神');
  });

  it('keeps the brief bounded for long articles', () => {
    const brief = buildBlogCoverSubjectContext({
      title: '',
      excerpt: '',
      content: '山谷'.repeat(2000),
    });
    expect(brief.length).toBeLessThanOrEqual(1800);
  });
});
