-- 资源标签表
CREATE TABLE IF NOT EXISTS resource_tags (
    id             BIGINT       PRIMARY KEY,
    name           VARCHAR(30)  NOT NULL,
    description    VARCHAR(100) NOT NULL DEFAULT '',
    resource_count INTEGER      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ,
    CONSTRAINT uq_resource_tags_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_resource_tags_deleted_at ON resource_tags (deleted_at);

-- 资源与标签的多对多关联表
CREATE TABLE IF NOT EXISTS resource_tag_relations (
    resource_id BIGINT NOT NULL,
    tag_id      BIGINT NOT NULL,
    PRIMARY KEY (resource_id, tag_id),
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)      REFERENCES resource_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_tag_relations_resource_id ON resource_tag_relations (resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_tag_relations_tag_id      ON resource_tag_relations (tag_id);
