ALTER TABLE posts ADD COLUMN visibility VARCHAR(20) DEFAULT 'private';

ALTER TABLE resources ADD COLUMN visibility VARCHAR(20) DEFAULT 'private';

UPDATE posts SET visibility = 'public' WHERE status = 'published' AND (visibility IS NULL OR visibility = '');
UPDATE posts SET visibility = 'private' WHERE status != 'published' AND (visibility IS NULL OR visibility = '');
UPDATE resources SET visibility = 'private' WHERE visibility IS NULL OR visibility = '';

CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
CREATE INDEX IF NOT EXISTS idx_resources_visibility ON resources(visibility);
