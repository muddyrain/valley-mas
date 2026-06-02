CREATE TABLE IF NOT EXISTS households (
    id BIGINT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'shared',
    owner_user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    dissolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_households_owner_user_id
ON households (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_households_kind
ON households (kind);

CREATE INDEX IF NOT EXISTS idx_households_status
ON households (status);

CREATE INDEX IF NOT EXISTS idx_households_deleted_at
ON households (deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_households_owner_personal
ON households (owner_user_id, kind)
WHERE deleted_at IS NULL AND kind = 'personal';

CREATE TABLE IF NOT EXISTS household_members (
    id BIGINT PRIMARY KEY,
    household_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_household_members_household_id
ON household_members (household_id);

CREATE INDEX IF NOT EXISTS idx_household_members_user_id
ON household_members (user_id);

CREATE INDEX IF NOT EXISTS idx_household_members_deleted_at
ON household_members (deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_household_member_status
ON household_members (household_id, user_id, status)
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS household_invites (
    id BIGINT PRIMARY KEY,
    household_id BIGINT NOT NULL,
    inviter_user_id BIGINT NOT NULL,
    invite_code VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    accepted_by_user_id BIGINT,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_household_invites_invite_code
ON household_invites (invite_code)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_household_invites_household_id
ON household_invites (household_id);

CREATE INDEX IF NOT EXISTS idx_household_invites_status
ON household_invites (status);

CREATE INDEX IF NOT EXISTS idx_household_invites_deleted_at
ON household_invites (deleted_at);

ALTER TABLE IF EXISTS life_trace_pantry_items
ADD COLUMN IF NOT EXISTS household_id BIGINT;

ALTER TABLE IF EXISTS life_trace_pantry_items
ADD COLUMN IF NOT EXISTS created_by BIGINT;

ALTER TABLE IF EXISTS life_trace_pantry_items
ADD COLUMN IF NOT EXISTS updated_by BIGINT;

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_household_id
ON life_trace_pantry_items (household_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_created_by
ON life_trace_pantry_items (created_by);

CREATE INDEX IF NOT EXISTS idx_life_trace_pantry_items_updated_by
ON life_trace_pantry_items (updated_by);
