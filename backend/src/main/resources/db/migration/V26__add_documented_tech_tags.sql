-- Add Linker's documented frontend, mobile, backend and infrastructure stack tags.
INSERT INTO tech_tags (name, category, sort_order, created_at, updated_at) VALUES
    ('Expo', 'MOBILE', 29, now(), now()),
    ('Spring Security', 'BACKEND', 30, now(), now()),
    ('JPA', 'BACKEND', 31, now(), now()),
    ('WebSocket', 'BACKEND', 32, now(), now()),
    ('STOMP', 'BACKEND', 33, now(), now()),
    ('CSS Modules', 'FRONTEND', 34, now(), now()),
    ('TanStack Query', 'FRONTEND', 35, now(), now()),
    ('Nginx', 'INFRA', 36, now(), now());
