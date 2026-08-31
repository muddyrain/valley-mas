-- +goose Up
CREATE TABLE article_packages (
    id BIGINT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    post_id BIGINT NULL,
    status VARCHAR(20) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    size BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL DEFAULT '',
    etag VARCHAR(160) NOT NULL DEFAULT '',
    entry_count INTEGER NOT NULL DEFAULT 0,
    expanded_size BIGINT NOT NULL DEFAULT 0,
    manifest_json TEXT NOT NULL,
    expires_at TIMESTAMPTZ NULL,
    delete_after TIMESTAMPTZ NULL,
    confirmed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uidx_article_packages_storage_key ON article_packages(storage_key);
CREATE INDEX idx_article_packages_owner_id ON article_packages(owner_id);
CREATE INDEX idx_article_packages_post_id ON article_packages(post_id);
CREATE INDEX idx_article_packages_status ON article_packages(status);
CREATE INDEX idx_article_packages_expires_at ON article_packages(expires_at);
CREATE INDEX idx_article_packages_delete_after ON article_packages(delete_after);
ALTER TABLE posts ADD COLUMN article_package_id BIGINT NULL;
ALTER TABLE posts ADD COLUMN package_download_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX idx_posts_article_package_id ON posts(article_package_id);

-- +goose Down
DROP INDEX IF EXISTS idx_posts_article_package_id;
ALTER TABLE posts DROP COLUMN IF EXISTS package_download_count;
ALTER TABLE posts DROP COLUMN IF EXISTS article_package_id;
DROP TABLE IF EXISTS article_packages;
