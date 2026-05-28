CREATE TABLE call_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID REFERENCES channels(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES dm_conversations(id) ON DELETE SET NULL,
    initiated_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    call_type       VARCHAR(20) NOT NULL
                    CHECK (call_type IN ('audio', 'video', 'screen_share')),
    routing_mode    VARCHAR(10) NOT NULL DEFAULT 'p2p'
                    CHECK (routing_mode IN ('p2p', 'sfu')),
    sfu_room_id     VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'ringing'
                    CHECK (status IN ('ringing', 'active', 'ended')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

CREATE TABLE call_participants (
    call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at         TIMESTAMPTZ,
    has_audio       BOOLEAN NOT NULL DEFAULT TRUE,
    has_video       BOOLEAN NOT NULL DEFAULT FALSE,
    has_screen      BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (call_session_id, user_id)
);

CREATE INDEX idx_calls_channel ON call_sessions(channel_id);
CREATE INDEX idx_calls_conversation ON call_sessions(conversation_id);
CREATE INDEX idx_calls_status ON call_sessions(status) WHERE status != 'ended';
CREATE INDEX idx_call_participants_user ON call_participants(user_id);
