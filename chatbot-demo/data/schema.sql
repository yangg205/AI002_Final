-- Luoc do cho phan dang nhap va luu lich su hoi thoai.
-- Chay lai duoc nhieu lan: moi cau lenh deu la IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
    id              bigserial PRIMARY KEY,
    username        text NOT NULL UNIQUE,
    password_hash   text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    consent_at      timestamptz,
    failed_attempts integer NOT NULL DEFAULT 0,
    locked_until    timestamptz
);

CREATE TABLE IF NOT EXISTS conversations (
    id         bigserial PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    title      text
);

CREATE INDEX IF NOT EXISTS conversations_user_idx
    ON conversations (user_id, started_at DESC);

-- content: LUON la ban da mask PII (xem masking.mask_text).
-- Cac cot noi (is_risk, risk_layer, intent, reply_source) de loc va thong ke;
-- phan chi tiet nam trong meta de sau nay them truong khong phai migrate.
CREATE TABLE IF NOT EXISTS messages (
    id              bigserial PRIMARY KEY,
    conversation_id bigint NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            text NOT NULL CHECK (role IN ('user', 'assistant')),
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    is_risk         boolean,
    risk_layer      text,
    intent          text,
    reply_source    text,
    meta            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx
    ON messages (conversation_id, id);

CREATE INDEX IF NOT EXISTS messages_risk_idx
    ON messages (is_risk)
    WHERE is_risk;
