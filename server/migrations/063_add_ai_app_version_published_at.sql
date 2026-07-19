-- 063: preserve every explicitly published AI app version for immutable references.
-- Legacy workflow versions through the current published pointer are retained so
-- existing parent workflow references remain executable after this migration.

ALTER TABLE ai_app_versions
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;

UPDATE ai_app_versions AS version
SET published_at = COALESCE(version.published_at, app.updated_at, NOW())
FROM ai_apps AS app
JOIN ai_app_versions AS current_published
  ON current_published.id = app.published_version_id
  AND current_published.app_id = app.id
WHERE version.app_id = app.id
  AND app.type = 'workflow'
  AND app.status = 'published'
  AND version.number <= current_published.number
  AND version.published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_app_versions_published_at
  ON ai_app_versions (published_at);
