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
    entry_count INT NOT NULL DEFAULT 0,
    expanded_size BIGINT NOT NULL DEFAULT 0,
    manifest_json LONGTEXT NOT NULL,
    expires_at DATETIME(3) NULL,
    delete_after DATETIME(3) NULL,
    confirmed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uidx_article_packages_storage_key (storage_key),
    KEY idx_article_packages_owner_id (owner_id),
    KEY idx_article_packages_post_id (post_id),
    KEY idx_article_packages_status (status),
    KEY idx_article_packages_expires_at (expires_at),
    KEY idx_article_packages_delete_after (delete_after)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE posts ADD COLUMN article_package_id BIGINT NULL;
ALTER TABLE posts ADD COLUMN package_download_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE posts ADD INDEX idx_posts_article_package_id (article_package_id);

-- +goose Down
ALTER TABLE posts DROP INDEX idx_posts_article_package_id;
ALTER TABLE posts DROP COLUMN package_download_count;
ALTER TABLE posts DROP COLUMN article_package_id;
DROP TABLE IF EXISTS article_packages;
