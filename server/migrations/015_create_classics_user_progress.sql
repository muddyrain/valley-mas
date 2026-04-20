-- 名著馆阅读进度（登录态跨设备同步）

CREATE TABLE IF NOT EXISTS classics_user_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    book_id BIGINT NOT NULL REFERENCES classics_books(id),
    edition_id BIGINT NOT NULL REFERENCES classics_editions(id),
    chapter_index INTEGER NOT NULL DEFAULT 0,
    chapter_title VARCHAR(300) DEFAULT '',
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_classics_user_progress_user_saved
    ON classics_user_progress(user_id, saved_at DESC);

