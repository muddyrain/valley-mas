import { describe, expect, it } from 'vitest';
import { parseFrontMatter } from './frontMatter';

describe('parseFrontMatter', () => {
  it('parses supported scalar and array metadata while returning trimmed content', () => {
    const result = parseFrontMatter(`---
title: "Release notes"
draft: false
views: 12
ratio: 1.5
tags: [web, 'release notes']
# ignored comment
---

  Body text  
`);

    expect(result).toEqual({
      data: {
        title: 'Release notes',
        draft: false,
        views: 12,
        ratio: 1.5,
        tags: ['web', 'release notes'],
      },
      content: 'Body text',
    });
  });

  it('keeps text unchanged when it does not have a complete front matter block', () => {
    const text = '---\ntitle: incomplete\nBody text';

    expect(parseFrontMatter(text)).toEqual({ data: {}, content: text });
  });
});
