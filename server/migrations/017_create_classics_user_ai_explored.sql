-- 名著馆 AI 探索记录（登录态跨设备同步）

CREATE TABLE IF NOT EXISTS classics_user_ai_explored (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    book_id BIGINT NOT NULL REFERENCES classics_books(id),
    chapter_index INTEGER NOT NULL DEFAULT 0,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id, chapter_index)
);

CREATE INDEX IF NOT EXISTS idx_classics_user_ai_explored_user_book_saved
    ON classics_user_ai_explored(user_id, book_id, saved_at DESC);
