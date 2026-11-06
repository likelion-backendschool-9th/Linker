#!/usr/bin/env python3
"""Isolated local GitHub verification. No production DB, credentials or account defaults."""
import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
import uuid

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = Path(__file__).with_name("compose.yml")
SQL_ROOT = ROOT / "backend/src/main/resources/db"
SCHEMAS = (
    "issue-schema/issue-cache.sql",
    "issue-schema/issue-sync-jobs.sql",
)
APP_KEYS = ("GITHUB_APP_ID", "GITHUB_APP_SLUG", "GITHUB_APP_PRIVATE_KEY",
            "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET")
PORTS = {"TEST_DB_PORT": "55432", "TEST_REDIS_PORT": "56379",
         "TEST_BACKEND_PORT": "8080", "TEST_WEB_PORT": "3000"}
SYSTEM_KEYS = ("PATH", "HOME", "JAVA_HOME", "GRADLE_USER_HOME", "DOCKER_HOST",
               "DOCKER_CONTEXT", "DOCKER_CONFIG", "TMPDIR", "TEMP", "TMP",
               "SystemRoot", "SYSTEMROOT", "USERPROFILE", "APPDATA", "LOCALAPPDATA",
               "COMSPEC", "PATHEXT")


class SetupError(ValueError):
    """A diagnostic authored here, never a provider/configuration response."""


def private_write(path, text):
    """Exclusive creation; never follow or overwrite an existing file/symlink."""
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        stream.write(text)


def state_directory(relative):
    path = Path(relative)
    if path.is_absolute() or not path.parts or path.parts[0] != ".local-notes" or ".." in path.parts:
        raise SetupError("State directory must be below repository .local-notes/")
    current = ROOT
    for part in path.parts:
        current /= part
        if current.is_symlink():
            raise SetupError("State directory must not contain symlinks")
    return current


def system_environment():
    return {key: os.environ[key] for key in SYSTEM_KEYS if key in os.environ}


def load_settings(directory):
    path = directory / ".env"
    if path.is_symlink() or not path.is_file():
        raise SetupError("Run init first; .env must be a regular private file")
    if os.name == "posix" and stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise SetupError("Set local .env permissions to 600 before continuing")
    settings = {}
    for number, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or key in settings:
            raise SetupError(f"Invalid/duplicate .env key at line {number}")
        if value.startswith(("'", '"')):
            if len(value) < 2 or value[-1] != value[0]:
                raise SetupError(f"Unclosed value at line {number}")
            value = value[1:-1]
        settings[key] = value
    for key in PORTS:
        value = settings.get(key, "")
        if not value.isdigit() or not 1024 <= int(value) <= 65535:
            raise SetupError(f"Invalid local port: {key}")
    if len({settings[key] for key in PORTS}) != len(PORTS):
        raise SetupError("Local DB, Redis, backend and web ports must be different")
    for key in ("DB_PASSWORD", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY",
                "GITHUB_TOKEN_ENCRYPTION_KEY", "GITHUB_WEBHOOK_SECRET"):
        if not settings.get(key):
            raise SetupError(f"Missing setting: {key}")
    return settings


def init(directory):
    ignored = subprocess.run(["git", "check-ignore", "--quiet", str(directory.relative_to(ROOT))],
                             cwd=ROOT, capture_output=True)
    if ignored.returncode:
        raise SetupError("Local state must be Git-ignored before keys are generated")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory.chmod(0o700)
    if any((directory / name).exists() or (directory / name).is_symlink()
           for name in (".env", "session-private.pem", "session-public.pem")):
        raise SetupError("Existing local settings/keys preserved; use another state directory")
    # Create private files before OpenSSL writes so permissions are private from creation.
    for name in ("session-private.pem", "session-public.pem"):
        private_write(directory / name, "")
    subprocess.run(["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048",
                    "-out", str(directory / "session-private.pem")],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["openssl", "pkey", "-in", str(directory / "session-private.pem"), "-pubout",
                    "-out", str(directory / "session-public.pem")],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    settings = {**PORTS, "DB_PASSWORD": secrets.token_urlsafe(32),
                "JWT_PRIVATE_KEY": (directory / "session-private.pem").read_text().strip().replace("\n", "\\n"),
                "JWT_PUBLIC_KEY": (directory / "session-public.pem").read_text().strip().replace("\n", "\\n"),
                "GITHUB_TOKEN_ENCRYPTION_KEY": base64.b64encode(secrets.token_bytes(32)).decode(),
                "GITHUB_WEBHOOK_SECRET": secrets.token_hex(32),
                **{key: "" for key in APP_KEYS}, "TEST_SMEE_URL": ""}
    private_write(directory / ".env", "# Local test settings. Never commit or share this file.\n"
                  + "".join(key + "=" + value + "\n" for key, value in settings.items()))
    print("Created private local settings. Existing root .env was not read or changed.")


def compose_command(directory):
    project = "linker-gh-test-" + hashlib.sha256(str(directory).encode()).hexdigest()[:10]
    return ["docker", "compose", "--env-file", os.devnull, "--project-name", project,
            "-f", str(COMPOSE)]


def compose_environment(settings):
    return {**system_environment(), **{key: settings[key] for key in
                                      ("DB_PASSWORD", "TEST_DB_PORT", "TEST_REDIS_PORT")}}


def require_local_docker():
    env = system_environment()
    endpoint = env.get("DOCKER_HOST") if not env.get("DOCKER_CONTEXT") else None
    if not endpoint:
        result = subprocess.run(["docker", "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
                                capture_output=True, text=True, env=env, check=True)
        endpoint = result.stdout.strip()
    if not endpoint.startswith(("unix://", "npipe://")):
        raise SetupError("Use a local Docker socket/context; remote Docker hosts are not allowed")


def compose(directory, settings, *args, sql=None, capture=False):
    require_local_docker()
    # Do not print Docker diagnostics: configuration errors may echo an interpolated secret.
    result = subprocess.run(compose_command(directory) + list(args), input=sql, text=True,
                            env=compose_environment(settings), capture_output=True)
    if result.returncode:
        raise SetupError("Dedicated Docker operation failed. Check Docker/ports locally; do not share config output.")
    if capture:
        return result.stdout.strip()


def database(directory, settings, sql):
    return compose(directory, settings, "exec", "-T", "db", "psql", "-X", "-U", "linker_test",
                   "-d", "linker_github_test", "-v", "ON_ERROR_STOP=1", "-At", sql=sql, capture=True)


def schema_fingerprints():
    return {name: hashlib.sha256((SQL_ROOT / name).read_bytes()).hexdigest() for name in SCHEMAS}


def schema_matches(directory):
    marker = directory / "schema.json"
    return marker.is_file() and not marker.is_symlink() and json.loads(marker.read_text()) == schema_fingerprints()


def prepare_schema(directory, settings):
    current = database(directory, settings, "SELECT current_database();")
    if current != "linker_github_test":
        raise SetupError("Refusing to prepare an unexpected database")
    if schema_matches(directory):
        required = database(directory, settings,
                            "SELECT to_regclass('teams') IS NOT NULL AND to_regclass('issue_sync_jobs') IS NOT NULL;")
        if required != "t":
            raise SetupError("Local schema marker does not match database state")
        print("Prepared schema already present; no SQL reapplied.")
        return
    if (directory / "schema.json").exists():
        raise SetupError("Prepared SQL changed; review the local upgrade or use another isolated environment")
    ready = database(directory, settings,
                     "SELECT to_regclass('users') IS NOT NULL AND to_regclass('github_repos') IS NOT NULL "
                     "AND to_regclass('flyway_schema_history') IS NOT NULL "
                     "AND to_regclass('teams') IS NOT NULL AND to_regclass('team_members') IS NOT NULL "
                     "AND to_regclass('github_installations') IS NOT NULL AND to_regclass('team_repos') IS NOT NULL "
                     "AND to_regclass('team_project_boards') IS NOT NULL "
                     "AND to_regclass('board_status_mappings') IS NOT NULL AND to_regclass('pull_requests') IS NOT NULL;")
    if ready != "t":
        raise SetupError("Start backend once so the normal Flyway history is applied first")
    history = database(directory, settings, "SELECT version FROM flyway_schema_history WHERE success ORDER BY version;")
    expected = {p.name.split('__')[0][1:] for p in (SQL_ROOT / "migration").glob("V*__*.sql")}
    if set(history.splitlines()) != expected:
        raise SetupError("Local Flyway history differs from this checkout; start the current backend first")
    existing = database(directory, settings, "SELECT to_regclass('issues') IS NOT NULL;")
    if existing != "f":
        raise SetupError("Existing unmarked issue schema preserved; review it before proceeding")
    sql = "BEGIN;\n" + "\n".join((SQL_ROOT / name).read_text() for name in SCHEMAS) + "\nCOMMIT;\n"
    database(directory, settings, sql)
    private_write(directory / "schema.json", json.dumps(schema_fingerprints(), indent=2) + "\n")
    print("C preparation SQL applied only to this isolated DB; B team tables come from Flyway V20.")


def backend_environment(directory, settings, enable_sync=False):
    if enable_sync and (not schema_matches(directory) or any(not settings.get(key) for key in APP_KEYS)):
        raise SetupError("Sync needs matching local schema and real App settings first")
    allowed = (*APP_KEYS, "GITHUB_TOKEN_ENCRYPTION_KEY", "GITHUB_WEBHOOK_SECRET", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY")
    env = {**system_environment(), **{key: settings[key] for key in allowed if key in settings}}
    env.update(DB_URL=f"jdbc:postgresql://127.0.0.1:{settings['TEST_DB_PORT']}/linker_github_test",
               DB_USERNAME="linker_test", DB_PASSWORD=settings["DB_PASSWORD"],
               REDIS_HOST="127.0.0.1", REDIS_PORT=settings["TEST_REDIS_PORT"],
               SERVER_ADDRESS="127.0.0.1", SERVER_PORT=settings["TEST_BACKEND_PORT"],
               GITHUB_USER_CALLBACK_URL=f"http://localhost:{settings['TEST_WEB_PORT']}/auth/callback",
               GITHUB_API_BASE_URL="https://api.github.com", GITHUB_WEB_BASE_URL="https://github.com",
               GITHUB_API_VERSION="2026-03-10",
               SESSION_COOKIE_SECURE="false", SESSION_COOKIE_DOMAIN="",
               ALLOWED_ORIGINS=f"http://localhost:{settings['TEST_WEB_PORT']}",
               DEBUG="false", SPRING_JPA_SHOW_SQL="false", LOGGING_LEVEL_ROOT="INFO",
               LOGGING_LEVEL_ORG_SPRINGFRAMEWORK="INFO", LOGGING_LEVEL_ORG_HIBERNATE_SQL="WARN")
    for key in ("TEAM_SETUP_WORKER_ENABLED", "TEAM_SETUP_WEBHOOK_ENABLED", "ISSUE_SYNC_ENABLED", "ISSUE_WEBHOOK_ENABLED"):
        env[key] = str(enable_sync).lower()
    return env


def web_environment(settings):
    # Explicit allowlist: no App private key, DB password, client secret, encryption key or session private key.
    return {**system_environment(), "JWT_PUBLIC_KEY": settings["JWT_PUBLIC_KEY"].replace("\\n", "\n"),
            "NEXT_PUBLIC_SITE_URL": f"http://localhost:{settings['TEST_WEB_PORT']}",
            "NEXT_PUBLIC_API_BASE_URL": f"http://localhost:{settings['TEST_BACKEND_PORT']}",
            "API_INTERNAL_URL": f"http://localhost:{settings['TEST_BACKEND_PORT']}",
            "NEXT_PUBLIC_USE_MOCKS": "false"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def http(settings, path, body=None, headers=None):
    # Targets and redirects are restricted to the configured loopback backend.
    request = Request(f"http://127.0.0.1:{settings['TEST_BACKEND_PORT']}" + path,
                      data=body, headers=headers or {})
    try:
        with build_opener(ProxyHandler({}), NoRedirect).open(request, timeout=10) as response:
            return response.status
    except HTTPError as error:
        return error.code


def verify_delivery(directory, settings, delivery_id):
    safe_id = str(uuid.UUID(delivery_id))
    row = database(directory, settings,
                   "SELECT event,COALESCE(action,''),status,attempts FROM github_webhook_deliveries "
                   f"WHERE delivery_id='{safe_id}';")
    if not row:
        raise SetupError("Delivery not present in the local DB; Smee HTTP 200 alone is not receiver success")
    print("Local delivery event|action|status|attempts:", row)
    return row


def smoke(directory, settings):
    delivery = str(uuid.uuid4())
    body = b'{"zen":"SYNTHETIC local preparation check, not a GitHub delivery"}'
    signature = "sha256=" + hmac.new(settings["GITHUB_WEBHOOK_SECRET"].encode(), body, hashlib.sha256).hexdigest()
    headers = {"Content-Type": "application/json", "X-GitHub-Event": "ping",
               "X-GitHub-Delivery": delivery, "X-Hub-Signature-256": signature}
    path = "/api/v1/webhook/github"
    if http(settings, path, body, headers) != 202 or http(settings, path, body, headers) != 200:
        raise SetupError("Synthetic signed ping or duplicate handling failed")
    invalid = {**headers, "X-GitHub-Delivery": str(uuid.uuid4()), "X-Hub-Signature-256": "sha256=" + "0" * 64}
    if http(settings, path, body, invalid) != 401:
        raise SetupError("Invalid signature was not rejected")
    for _ in range(40):
        row = database(directory, settings,
                       f"SELECT status FROM github_webhook_deliveries WHERE delivery_id='{delivery}';")
        if row == "PROCESSED":
            print("PASS synthetic-only: signed 202, duplicate 200, invalid signature 401, queue -> PROCESSED")
            return
        time.sleep(0.5)
    raise SetupError("Synthetic delivery was not processed; inspect local worker/Redis")


def launch(args, directory, settings):
    if args.command == "backend":
        env = backend_environment(directory, settings, args.enable_sync)
        if args.enable_sync:
            # A marker alone is insufficient if the selected local DB/volume changed.
            prepare_schema(directory, settings)
        if args.build:
            subprocess.run([str(ROOT / "backend/gradlew"), "bootJar"], cwd=ROOT / "backend",
                           env=system_environment(), check=True)
        jars = list((ROOT / "backend/build/libs").glob("*-SNAPSHOT.jar"))
        if len(jars) != 1:
            raise SetupError("Build backend bootJar first, or pass backend --build")
        java_home = env.get("JAVA_HOME")
        executable = str(Path(java_home) / "bin/java") if java_home else shutil.which("java")
        command, cwd = [executable, "-jar", str(jars[0])], ROOT / "backend"
    elif args.command == "web":
        env = web_environment(settings)
        command, cwd = [shutil.which("pnpm"), "--filter", "web", "dev", "--hostname", "127.0.0.1",
                        "--port", settings["TEST_WEB_PORT"]], ROOT / "frontend"
    else:
        url = urlsplit(settings.get("TEST_SMEE_URL", ""))
        if url.scheme != "https" or url.netloc != "smee.io" or not re.fullmatch(r"/[A-Za-z0-9]+", url.path) or url.query or url.fragment:
            raise SetupError("Set TEST_SMEE_URL to your test-only https://smee.io/channel URL")
        env = system_environment()
        command, cwd = [shutil.which("npx"), "--yes", "smee-client@5.0.0", "--url", url.geturl(),
                        "--target", f"http://127.0.0.1:{settings['TEST_BACKEND_PORT']}/api/v1/webhook/github"], ROOT
    if not command[0]:
        raise SetupError("Required Java/pnpm/npx executable was not found")
    os.chdir(cwd)
    os.execvpe(command[0], command, env)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", default=".local-notes/github-integration-test")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("init", "up", "down", "schema", "web", "relay", "check", "smoke"):
        sub.add_parser(name)
    backend = sub.add_parser("backend")
    backend.add_argument("--build", action="store_true")
    backend.add_argument("--enable-sync", action="store_true")
    delivery = sub.add_parser("delivery")
    delivery.add_argument("delivery_id")
    args = parser.parse_args()
    directory = state_directory(args.state_dir)
    if args.command == "init":
        init(directory)
        return
    settings = load_settings(directory)
    if args.command == "up":
        compose(directory, settings, "up", "-d", "--wait", "--wait-timeout", "90")
        print("Dedicated local DB/Redis ready; root Compose and shared DB were not used.")
    elif args.command == "down":
        compose(directory, settings, "down")
        print("Dedicated containers stopped; persistent data volumes retained.")
    elif args.command == "schema":
        prepare_schema(directory, settings)
    elif args.command == "check":
        print("Local backend OpenAPI HTTP", http(settings, "/v3/api-docs"))
        missing = [key for key in APP_KEYS if not settings.get(key)]
        print("App settings:", "missing " + ", ".join(missing) if missing else "configured (not proof of GitHub authentication)")
        print("Prepared schema:", "matching" if schema_matches(directory) else "not prepared/current")
    elif args.command == "smoke":
        smoke(directory, settings)
    elif args.command == "delivery":
        verify_delivery(directory, settings, args.delivery_id)
    else:
        launch(args, directory, settings)


if __name__ == "__main__":
    try:
        main()
    except SetupError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (ValueError, OSError, subprocess.SubprocessError):
        # Never expose subprocess output, URLs with auth codes, or configuration values.
        print("Local verification failed. Check command prerequisites, private settings and local logs; do not share secrets.", file=sys.stderr)
        sys.exit(1)
