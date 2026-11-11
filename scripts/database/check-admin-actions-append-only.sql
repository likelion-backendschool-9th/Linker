-- Read-only production check; use the actual backend DB role, not the psql login:
-- psql ... -v app_role=BACKEND_DB_USERNAME -f scripts/database/check-admin-actions-append-only.sql
-- Exits 3 when protection is missing. Never inserts, updates, deletes, or changes grants.
\set ON_ERROR_STOP on
\if :{?app_role}
\else
DO $$ BEGIN
  RAISE EXCEPTION 'app_role is required; pass the actual backend DB username.';
END $$;
\endif
BEGIN READ ONLY;
WITH catalog AS (
  SELECT r.oid AS role_oid, c.oid AS table_oid, c.relowner,
    CASE WHEN c.oid IS NOT NULL
      THEN to_regclass(pg_get_serial_sequence('public.admin_actions', 'id')) END AS sequence_oid
  FROM (VALUES (1)) seed(id)
  LEFT JOIN pg_roles r ON r.rolname = :'app_role'
  LEFT JOIN pg_class c ON c.oid = to_regclass('public.admin_actions')
), checks AS (
  SELECT :'app_role'::text AS app_role,
    role_oid IS NOT NULL AS role_exists,
    table_oid IS NOT NULL AS table_exists,
    COALESCE(EXISTS (
      SELECT 1 FROM pg_roles elevated
      WHERE (elevated.rolsuper OR elevated.rolcreaterole)
        AND pg_has_role(role_oid, elevated.oid, 'MEMBER')
    ), false) AS elevated_role_access,
    COALESCE(pg_has_role(role_oid, relowner, 'MEMBER'), false) AS owner_role_access,
    COALESCE(has_table_privilege(role_oid, table_oid, 'SELECT'), false) AS can_select,
    COALESCE(has_table_privilege(role_oid, table_oid, 'INSERT'), false) AS can_insert,
    COALESCE(has_table_privilege(role_oid, table_oid,
      'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES'), false) AS can_mutate,
    COALESCE(has_sequence_privilege(role_oid, sequence_oid, 'USAGE'), false) AS can_use_sequence
  FROM catalog
), result AS (
  SELECT checks.*, role_exists AND table_exists
    AND NOT elevated_role_access AND NOT owner_role_access
    AND can_select AND can_insert AND NOT can_mutate AND can_use_sequence AS ready
  FROM checks
)
SELECT row_to_json(result) AS report, ready FROM result
\gset audit_
\echo :audit_report
ROLLBACK;
\if :audit_ready
\echo 'PASS: the application role can append/read audit rows without mutation privileges.'
\else
DO $$ BEGIN
  RAISE EXCEPTION 'FAIL: audit DB protection is incomplete; coordinate the runtime/migration role split before applying grants.'
    USING ERRCODE = '42501';
END $$;
\endif
