#!/usr/bin/env python3
"""macOS/WSL/Linux helper for the team's shared PostgreSQL and local Redis."""

import argparse
import getpass
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import struct
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PERSONAL_KEYS = {
    "DB_PASSWORD", "DB_USERNAME", "SSH_USER", "SSH_KEY_FILE", "LOCAL_DB_PORT",
    "REDIS_HOST", "REDIS_PORT", "BACKEND_PORT",
}
BACKEND_ENV_KEYS = (
    "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", "GITHUB_WEBHOOK_SECRET", "GITHUB_APP_ID",
    "GITHUB_APP_SLUG", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET", "GITHUB_USER_CALLBACK_URL", "GITHUB_WEB_BASE_URL",
    "GITHUB_TOKEN_ENCRYPTION_KEY", "GITHUB_API_BASE_URL",
    "GITHUB_API_VERSION", "GITHUB_HTTP_TIMEOUT", "GITHUB_INSTALL_STATE_TTL",
    "GITHUB_WEBHOOK_MAX_ATTEMPTS", "GITHUB_WEBHOOK_RETRY_DELAY",
    "GITHUB_WEBHOOK_RECEIVED_TIMEOUT", "GITHUB_WEBHOOK_RECOVERY_BATCH_SIZE",
    "GITHUB_WEBHOOK_RECOVERY_DELAY_MS",
)


def backend_settings_from_dotenv():
    """Read selected JWT/GitHub settings literally; never import local DB settings."""
    path = ROOT / ".env"
    values = {}
    if not path.exists():
        return values
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key, value = key.strip(), value.strip()
        if key not in BACKEND_ENV_KEYS:
            continue
        if value[:1] in {"'", '"'}:
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError(f".env:{number}: 따옴표를 확인해 주세요.")
            value = value[1:-1]
        values[key] = value
    return values


def personal_settings(path):
    """Literal KEY=value parsing: no shell execution or $variable interpolation."""
    values = {}
    if path.exists():
        for number, line in enumerate(path.read_text().splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, separator, value = line.partition("=")
            key, value = key.strip(), value.strip()
            if not separator or key not in PERSONAL_KEYS:
                raise ValueError(f"{path.name}:{number}: 지원하지 않는 설정 이름이에요.")
            if value[:1] in {"'", '"'}:
                if len(value) < 2 or value[-1] != value[0]:
                    raise ValueError(f"{path.name}:{number}: 따옴표를 확인해 주세요.")
                value = value[1:-1]
            values[key] = value
    values.update({key: os.environ[key] for key in PERSONAL_KEYS if key in os.environ})
    return values


def port(value):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError("포트는 1~65535 범위의 정수여야 해요.") from None
    if not 1 <= number <= 65535:
        raise ValueError("포트는 1~65535 범위여야 해요.")
    return number


def ssh_command(common, personal):
    host = common["ssh_host"]
    user = personal.get("SSH_USER", common["ssh_user"])
    if not re.fullmatch(r"[a-zA-Z0-9.-]+", host) or not re.fullmatch(r"[a-zA-Z0-9_-]+", user):
        raise ValueError("SSH 주소·계정을 확인해 주세요.")
    command = [
        "ssh", "-p", str(port(common["ssh_port"])),
        "-o", "StrictHostKeyChecking=yes", "-o", "ExitOnForwardFailure=yes",
        "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=30",
        "-o", "ServerAliveCountMax=3",
    ]
    if personal.get("SSH_KEY_FILE"):
        command += ["-i", str(Path(personal["SSH_KEY_FILE"]).expanduser()), "-o", "IdentitiesOnly=yes"]
    return command, f"{user}@{host}"


def discover_ip(common, command, target):
    container = common["db_container"]
    if not re.fullmatch(r"[a-zA-Z0-9_.-]+", container):
        raise ValueError("DB 컨테이너 이름을 확인해 주세요.")
    # Remote sudo must not consume the terminal for a password; fail clearly instead.
    remote = "sudo -n docker inspect --format '{{json .NetworkSettings.Networks}}' " + container
    result = subprocess.run(command + [target, remote], stdout=subprocess.PIPE, text=True, check=True)
    networks = json.loads(result.stdout)
    selected = networks.get(common["db_network"])
    if selected is None and len(networks) == 1:
        selected = next(iter(networks.values()))
    if not selected:
        raise ValueError("DB 네트워크를 고르지 못했어요. 서버 담당자에게 확인해 주세요.")
    address = ipaddress.ip_address(selected["IPAddress"])
    if address.version != 4:
        raise ValueError("DB IPv4 주소가 필요해요.")
    return str(address)


def ensure_free_port(local_port, setting="LOCAL_DB_PORT"):
    with socket.socket() as listener:
        try:
            listener.bind(("127.0.0.1", local_port))
        except OSError as error:
            raise ValueError(f"로컬 {local_port} 포트가 사용 중이에요. 기존 실행을 종료하거나 {setting}를 바꿔 주세요.") from error


def wait_for_postgres(tunnel, local_port, timeout=90):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if tunnel.poll() is not None:
            raise ValueError("SSH 터널이 종료됐어요. 위 SSH 오류를 확인해 주세요.")
        try:
            with socket.create_connection(("127.0.0.1", local_port), timeout=1) as connection:
                connection.settimeout(1)
                connection.sendall(struct.pack("!II", 8, 80877103))  # PostgreSQL SSLRequest
                if connection.recv(1) in {b"S", b"N"}:
                    return
        except OSError:
            pass
        time.sleep(0.25)
    raise ValueError("터널 뒤의 PostgreSQL 응답을 확인하지 못했어요. 서버 DB 상태·네트워크를 확인해 주세요.")


def check_redis(host, redis_port):
    """Read-only PING check; a listening TCP port alone is not Redis readiness."""
    try:
        with socket.create_connection((host, redis_port), timeout=3) as connection:
            connection.settimeout(3)
            connection.sendall(b'*1\r\n$4\r\nPING\r\n')
            with connection.makefile('rb') as reply:
                response = reply.readline(8)
    except OSError:
        raise ValueError("Redis에 연결하지 못했어요. 로컬 Redis 실행과 REDIS_HOST·REDIS_PORT를 확인해 주세요.") from None
    if response != b'+PONG\r\n':
        raise ValueError("Redis PONG 응답을 확인하지 못했어요. 인증 없는 로컬 Redis와 REDIS_HOST·REDIS_PORT를 확인해 주세요.")


def backend_environment(common, personal, local_port, password):
    environment = dict(os.environ)
    environment.update({
        "DB_URL": f"jdbc:postgresql://127.0.0.1:{local_port}/{common['db_name']}",
        "DB_USERNAME": personal.get("DB_USERNAME", common["db_user"]),
        "DB_PASSWORD": password,
        "REDIS_HOST": personal.get("REDIS_HOST", "127.0.0.1"),
        "REDIS_PORT": str(port(personal.get("REDIS_PORT", 6379))),
        "SERVER_PORT": str(port(personal.get("BACKEND_PORT", 8080))),
        # Disable Hibernate DDL / SQL init; Flyway still follows Spring configuration.
        "SPRING_JPA_HIBERNATE_DDL_AUTO": "none",
        "SPRING_SQL_INIT_MODE": "never",
    })
    for key, value in backend_settings_from_dotenv().items():
        environment.setdefault(key, value)
    # Shared DB + personal Redis must not drain/recover another worker's deliveries.
    environment.setdefault("LINKER_WEBHOOK_CONSUMER_ENABLED", "false")
    return environment


def stop_process(process):
    if process is not None and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main():
    parser = argparse.ArgumentParser(description="팀 공통 서버 DB 접속 (macOS/WSL/Linux)")
    parser.add_argument("mode", choices=["tunnel", "backend"], help="DB 도구용 터널 / 터널과 백엔드 함께 실행")
    args = parser.parse_args()
    if os.name != "posix" or not shutil.which("ssh"):
        parser.error("macOS·WSL/Linux 터미널과 OpenSSH가 필요해요.")
    common = json.loads((ROOT / "config/remote-db.json").read_text())
    personal = personal_settings(ROOT / ".env.remote-db")
    local_port = port(personal.get("LOCAL_DB_PORT", common["local_port"]))
    ensure_free_port(local_port)
    command, target = ssh_command(common, personal)
    backend_env = None
    if args.mode == "backend":
        if not shutil.which("java"):
            raise ValueError("백엔드 실행에는 Java 21이 필요해요.")
        backend_port = port(personal.get("BACKEND_PORT", 8080))
        if backend_port == local_port:
            raise ValueError("LOCAL_DB_PORT와 BACKEND_PORT는 서로 다른 포트여야 해요.")
        ensure_free_port(backend_port, "BACKEND_PORT")
        check_redis(personal.get("REDIS_HOST", "127.0.0.1"), port(personal.get("REDIS_PORT", 6379)))
        print("Redis PONG 응답을 확인했어요.", flush=True)
        password = personal.get("DB_PASSWORD") or getpass.getpass("서버 DB 비밀번호: ")
        if not password:
            raise ValueError("DB 비밀번호를 입력해 주세요.")
        backend_env = backend_environment(common, personal, local_port, password)
    print("서버 DB의 현재 IP를 확인합니다. SSH 인증이 필요할 수 있어요.", flush=True)
    address = discover_ip(common, command, target)
    forward = f"127.0.0.1:{local_port}:{address}:{port(common['db_port'])}"
    print("SSH 터널을 엽니다. 비밀번호 방식이면 한 번 더 입력할 수 있어요.", flush=True)
    tunnel = subprocess.Popen(command + ["-N", "-L", forward, target])
    backend = None
    try:
        wait_for_postgres(tunnel, local_port)
        print(f"PostgreSQL 응답 확인: 127.0.0.1:{local_port} / DB={common['db_name']} / 사용자={personal.get('DB_USERNAME', common['db_user'])}", flush=True)
        print("이 창을 유지하세요. 종료: Ctrl+C. DB 인증은 DB 도구 또는 백엔드에서 확인합니다.", flush=True)
        if args.mode == "tunnel":
            return tunnel.wait()
        # No password in command arguments or console output.
        backend = subprocess.Popen(
            ["bash", "./gradlew", "--no-daemon", "bootRun"], cwd=ROOT / "backend",
            env=backend_env,
        )
        while backend.poll() is None:
            if tunnel.poll() is not None:
                raise ValueError("SSH 터널이 끊겨 로컬 백엔드도 종료합니다. 연결 후 다시 실행해 주세요.")
            time.sleep(0.5)
        return backend.returncode
    finally:
        stop_process(backend)
        stop_process(tunnel)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nDB 접속 작업을 종료했어요.")
        sys.exit(130)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        # Values of personal settings (especially passwords) must never be printed.
        message = str(error) if isinstance(error, ValueError) else "SSH·파일·실행 환경을 확인해 주세요. 위 오류와 접속 안내 문서를 참고하세요."
        print(message, file=sys.stderr)
        sys.exit(1)
