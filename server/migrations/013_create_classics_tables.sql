-- 名著馆相关表（PostgreSQL）

-- 作者表
CREATE TABLE IF NOT EXISTS classics_authors (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    dynasty VARCHAR(50),
    brief TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 书籍主表
CREATE TABLE IF NOT EXISTS classics_books (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    cover_url VARCHAR(500),
    category VARCHAR(50) NOT NULL DEFAULT '',
    dynasty VARCHAR(50),
    brief TEXT,
    word_count INTEGER DEFAULT 0,
    chapter_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 书籍-作者关联
CREATE TABLE IF NOT EXISTS classics_book_authors (
    book_id BIGINT NOT NULL REFERENCES classics_books(id),
    author_id BIGINT NOT NULL REFERENCES classics_authors(id),
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (book_id, author_id)
);

-- 版本表
CREATE TABLE IF NOT EXISTS classics_editions (
    id BIGSERIAL PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES classics_books(id),
    label VARCHAR(200) NOT NULL,
    translator VARCHAR(100),
    publish_year INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 章节表
CREATE TABLE IF NOT EXISTS classics_chapters (
    id BIGSERIAL PRIMARY KEY,
    edition_id BIGINT NOT NULL REFERENCES classics_editions(id),
    book_id BIGINT NOT NULL REFERENCES classics_books(id),
    chapter_index INTEGER NOT NULL,
    title VARCHAR(300) NOT NULL,
    content TEXT,
    word_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(edition_id, chapter_index)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_classics_books_category ON classics_books(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classics_books_published ON classics_books(is_published) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classics_chapters_edition ON classics_chapters(edition_id, chapter_index);
