ALTER TABLE posts
    ADD COLUMN sort_order INTEGER DEFAULT 0;

ALTER TABLE posts
    ADD COLUMN group_sort_order INTEGER DEFAULT 0;

CREATE INDEX idx_posts_sort_order ON posts(sort_order);
CREATE INDEX idx_posts_group_sort_order ON posts(group_sort_order);
