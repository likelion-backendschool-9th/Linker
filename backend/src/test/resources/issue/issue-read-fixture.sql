-- TEST ONLY D subscription projection. B team tables come from the real V20 migration.
CREATE TABLE subscriptions(id bigint PRIMARY KEY,team_id bigint,plan text,status text,current_period_end timestamptz,grace_until timestamptz);
