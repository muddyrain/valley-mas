-- 阅读库 TXT 自动建书导入任务表

CREATE TABLE IF NOT EXISTS classics_import_jobs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    stage VARCHAR(200) NOT NULL DEFAULT '',
    progress INTEGER NOT NULL DEFAULT 0,
    attempt INTEGER NOT NULL DEFAULT 1,
    source_file_name VARCHAR(255),
    payload_json TEXT NOT NULL,
    error_message TEXT,
    created_book_id BIGINT REFERENCES classics_books(id),
    created_edition_id BIGINT REFERENCES classics_editions(id),
    imported_chapters INTEGER NOT NULL DEFAULT 0,
    total_words INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classics_import_jobs_user_created
    ON classics_import_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_classics_import_jobs_status
    ON classics_import_jobs(status);
