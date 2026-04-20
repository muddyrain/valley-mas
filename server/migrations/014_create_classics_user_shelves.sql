-- 名著馆用户书架（登录态跨设备同步）

CREATE TABLE IF NOT EXISTS classics_user_shelves (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    book_id BIGINT NOT NULL REFERENCES classics_books(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_classics_user_shelves_user_updated
    ON classics_user_shelves(user_id, updated_at DESC);

