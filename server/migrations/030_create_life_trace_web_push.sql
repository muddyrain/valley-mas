CREATE TABLE IF NOT EXISTS life_trace_push_subscriptions (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    user_agent VARCHAR(500),
    last_error VARCHAR(500),
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_life_trace_push_subscriptions_user_status
ON life_trace_push_subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_life_trace_push_subscriptions_deleted_at
ON life_trace_push_subscriptions (deleted_at);

CREATE TABLE IF NOT EXISTS life_trace_push_deliveries (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    subscription_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent',
    error VARCHAR(500),
    created_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_life_trace_push_delivery
ON life_trace_push_deliveries (user_id, plan_id, due_at, subscription_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_push_deliveries_plan_id
ON life_trace_push_deliveries (plan_id);

CREATE INDEX IF NOT EXISTS idx_life_trace_push_deliveries_deleted_at
ON life_trace_push_deliveries (deleted_at);
