-- Run only after the team selects a non-owner application role:
-- psql ... -v app_role=APPROVED_ROLE -f scripts/database/admin-actions-append-only.sql
-- This script does not create/select a role, change the DB owner, or run automatically.
\set ON_ERROR_STOP on
\if :{?app_role}
\else
DO $$ BEGIN
  RAISE EXCEPTION 'app_role is required; use a team-approved non-owner application role.';
END $$;
\endif
BEGIN;
SELECT set_config('linker.audit_app_role', :'app_role', true);
DO $$
DECLARE
  app_name text := current_setting('linker.audit_app_role');
  app_oid oid;
  owner_oid oid;
  sequence_name text;
BEGIN
  SELECT oid INTO app_oid FROM pg_roles WHERE rolname=app_name;
  SELECT relowner INTO owner_oid FROM pg_class WHERE oid='public.admin_actions'::regclass;
  IF app_oid IS NULL OR EXISTS (SELECT 1 FROM pg_roles elevated
      WHERE (elevated.rolsuper OR elevated.rolcreaterole) AND pg_has_role(app_oid,elevated.oid,'MEMBER'))
      OR pg_has_role(app_oid,owner_oid,'MEMBER') THEN
    RAISE EXCEPTION 'Application role must exist and must not own/inherit ownership of admin_actions or manage roles';
  END IF;
  REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.admin_actions FROM PUBLIC;
  EXECUTE format('REVOKE ALL ON public.admin_actions FROM %I',app_name);
  EXECUTE format('GRANT SELECT, INSERT ON public.admin_actions TO %I',app_name);
  sequence_name := pg_get_serial_sequence('public.admin_actions','id');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO %I',sequence_name,app_name);
  END IF;
  IF has_table_privilege(app_oid,'public.admin_actions','UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') THEN
    RAISE EXCEPTION 'Application role still inherits write privileges; coordinate inherited grants first';
  END IF;
END $$;
COMMIT;
