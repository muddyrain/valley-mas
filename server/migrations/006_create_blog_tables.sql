-- 创建博客相关表

-- 文章分类表
CREATE TABLE IF NOT EXISTS post_categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- 文章标签表
CREATE TABLE IF NOT EXISTS post_tags (
    id INTEGER PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE,
    slug VARCHAR(30) NOT NULL UNIQUE,
    post_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- 文章表
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    html_content TEXT,
    excerpt VARCHAR(500),
    cover VARCHAR(500),
    author_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_top BOOLEAN DEFAULT FALSE,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES post_categories(id)
);

-- 文章标签关联表
CREATE TABLE IF NOT EXISTS post_tag_relations (
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES post_tags(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_is_top ON posts(is_top);

-- 插入默认分类
INSERT OR IGNORE INTO post_categories (id, name, slug, description, sort_order) VALUES 
    (1, '技术', 'tech', '技术相关文章', 1),
    (2, '生活', 'life', '生活随笔', 2),
    (3, '教程', 'tutorial', '教程文档', 3);

-- 插入示例文章（可选）
INSERT OR IGNORE INTO posts (id, title, slug, content, excerpt, author_id, category_id, status, published_at) VALUES 
    (100001, '欢迎使用博客系统', 'welcome', '# 欢迎使用博客系统

这是一个示例文章，你可以：

- 在后台管理界面创建新文章
- 使用 Markdown 格式编写内容
- 添加分类和标签

## 代码示例

```javascript
console.log("Hello, World!");
```

祝你使用愉快！', '博客系统安装成功的欢迎文章', 1, 1, 'published', datetime('now'));
