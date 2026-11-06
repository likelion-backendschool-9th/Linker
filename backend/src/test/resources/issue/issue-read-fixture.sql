-- TEST ONLY: projections of B/D-owned tables, not product migrations or implementations.
-- github_repos comes from Flyway V12__post_editor.sql — do not recreate it here.
CREATE TABLE github_installations(id bigint PRIMARY KEY,github_installation_id bigint UNIQUE,removed_at timestamptz,suspended_at timestamptz);
CREATE TABLE teams(id bigint PRIMARY KEY,installation_id bigint,github_org_id bigint,github_org_login text,status text);
CREATE TABLE team_repos(id bigint PRIMARY KEY,team_id bigint,repo_id bigint,UNIQUE(team_id,repo_id));
CREATE TABLE team_members(id bigint PRIMARY KEY,team_id bigint,user_id bigint,role text,left_at timestamptz,github_org_state text DEFAULT 'MEMBER');
CREATE TABLE team_project_boards(id bigint PRIMARY KEY,team_id bigint,github_project_node_id text,status_field_id text,start_date_field_id text,due_date_field_id text);
CREATE TABLE board_status_mappings(id bigint PRIMARY KEY,board_id bigint,github_option_id text,linker_status text);
CREATE TABLE subscriptions(id bigint PRIMARY KEY,team_id bigint,plan text,status text,current_period_end timestamptz,grace_until timestamptz);
