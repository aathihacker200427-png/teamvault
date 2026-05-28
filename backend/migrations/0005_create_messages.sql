CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID REFERENCES channels(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES dm_conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content         TEXT NOT NULL,
    reply_to_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
    edited_at       TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_message_parent CHECK (
        (channel_id IS NOT NULL AND conversation_id IS NULL) OR
        (channel_id IS NULL AND conversation_id IS NOT NULL)
    )
);

CREATE INDEX idx_messages_channel_created
    ON messages(channel_id, created_at DESC)
    WHERE channel_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_messages_conversation_created
    ON messages(conversation_id, created_at DESC)
    WHERE conversation_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_messages_sender ON messages(sender_id);

CREATE INDEX idx_messages_content_fts
    ON messages USING gin(to_tsvector('english', content));

CREATE TABLE message_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    content_type    VARCHAR(100) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    storage_path    TEXT NOT NULL,
    thumbnail_path  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON message_attachments(message_id);

CREATE TABLE read_receipts (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, message_id)
);
