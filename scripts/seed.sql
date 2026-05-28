INSERT INTO users (email, password_hash, display_name) VALUES
('alice@example.com', '$argon2id$v=19$m=19456,t=2,p=1$WJr8VZq5YqXqZ8KqKqKqKq$KqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKq', 'Alice Smith'),
('bob@example.com', '$argon2id$v=19$m=19456,t=2,p=1$WJr8VZq5YqXqZ8KqKqKqKq$KqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKq', 'Bob Johnson'),
('charlie@example.com', '$argon2id$v=19$m=19456,t=2,p=1$WJr8VZq5YqXqZ8KqKqKqKq$KqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKq', 'Charlie Brown')
ON CONFLICT (email) DO NOTHING;

INSERT INTO workspaces (name, slug, owner_id)
SELECT 'Demo Workspace', 'demo-workspace', id FROM users WHERE email = 'alice@example.com'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, u.id, 'owner' FROM workspaces w, users u WHERE w.slug = 'demo-workspace' AND u.email = 'alice@example.com'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, u.id, 'member' FROM workspaces w, users u WHERE w.slug = 'demo-workspace' AND u.email = 'bob@example.com'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO channels (workspace_id, name, topic, created_by)
SELECT w.id, 'general', 'General discussion', u.id FROM workspaces w, users u WHERE w.slug = 'demo-workspace' AND u.email = 'alice@example.com'
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO channels (workspace_id, name, topic, created_by)
SELECT w.id, 'random', 'Random stuff', u.id FROM workspaces w, users u WHERE w.slug = 'demo-workspace' AND u.email = 'alice@example.com'
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO channel_members (channel_id, user_id, role)
SELECT c.id, wm.user_id, 'member' FROM channels c, workspace_members wm WHERE c.workspace_id = wm.workspace_id
ON CONFLICT (channel_id, user_id) DO NOTHING;
