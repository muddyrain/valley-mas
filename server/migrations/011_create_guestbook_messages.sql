-- 访客留言墙
CREATE TABLE IF NOT EXISTS guestbook_messages (
    id         BIGINT       PRIMARY KEY,
    user_id    BIGINT,
    nickname   VARCHAR(40)  NOT NULL,
    avatar     VARCHAR(500) NOT NULL DEFAULT '',
    content    VARCHAR(1000) NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'approved',
    is_pinned  BOOLEAN      NOT NULL DEFAULT FALSE,
    client_ip  VARCHAR(64)  NOT NULL DEFAULT '',
    user_agent VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_guestbook_messages_status ON guestbook_messages(status);
CREATE INDEX IF NOT EXISTS idx_guestbook_messages_is_pinned ON guestbook_messages(is_pinned);
CREATE INDEX IF NOT EXISTS idx_guestbook_messages_created_at ON guestbook_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guestbook_messages_deleted_at ON guestbook_messages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_guestbook_messages_user_id ON guestbook_messages(user_id);
