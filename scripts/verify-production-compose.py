#!/usr/bin/env python3
"""Validate the merged server configuration without reading .env or contacting Docker."""

import json
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def configuration(*files):
    command = ["docker", "compose", "--env-file", "/dev/null"]
    for file in files:
        command.extend(["-f", file])
    command.extend(["config", "--format", "json"])
    result = subprocess.run(
        command,
        cwd=ROOT,
        env={
            **os.environ,
            "DB_PASSWORD": "compose-validation-only",
            "JWT_PRIVATE_KEY": "compose-validation-only",
            "JWT_PUBLIC_KEY": "compose-validation-only",
            "GITHUB_APP_ID": "123",
            "GITHUB_APP_SLUG": "linker-validation",
            "GITHUB_APP_PRIVATE_KEY": "github-app-validation-only",
            "GITHUB_WEBHOOK_SECRET": "github-webhook-validation-only",
            "PROXY_PORT": "3004",
            "IMAGE_PREFIX": "ghcr.io/example/linker",
            "IMAGE_TAG": "a" * 40,
        },
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def main():
    base = configuration("compose.yml")
    production = configuration("compose.yml", "compose.prod.yml")
    services = production["services"]
    assert set(services) == {"db", "redis", "backend", "web", "proxy"}
    for name, service in services.items():
        if name != "proxy":
            assert not service.get("ports"), f"{name}: debug port still published"
        assert service["restart"] == "unless-stopped", name
        assert service["logging"] == {
            "driver": "json-file",
            "options": {"max-file": "3", "max-size": "10m"},
        }, name
        assert float(service["cpus"]) > 0 and int(service["mem_limit"]) > 0, name

    ports = services["proxy"]["ports"]
    assert len(ports) == 1
    assert ports[0]["host_ip"] == "127.0.0.1"
    assert str(ports[0]["published"]) == "3004" and ports[0]["target"] == 80
    mount = services["proxy"]["volumes"]
    assert len(mount) == 1, "local Nginx configuration must be replaced"
    assert mount[0]["source"] == str(ROOT / "nginx/production.conf")
    assert mount[0]["read_only"]

    # Transition must reuse the existing DB/Redis volumes and health checks.
    assert production["name"] == base["name"]
    assert production["volumes"] == base["volumes"]
    for name in ["db", "redis"]:
        assert services[name]["volumes"] == base["services"][name]["volumes"]
    for name in services:
        assert services[name]["healthcheck"] == base["services"][name]["healthcheck"]
    assert base["services"]["db"]["ports"], "local debugging must still be available"
    images = configuration("compose.yml", "compose.prod.yml", "compose.images.yml")
    for name in ["web", "backend"]:
        assert not images["services"][name].get("build"), name
        assert images["services"][name]["image"] == f"ghcr.io/example/linker-{name}:{'a' * 40}"
        for field in ["ports", "healthcheck", "restart", "mem_limit"]:
            assert images["services"][name].get(field) == services[name].get(field)
    assert images["volumes"] == production["volumes"]
    github_settings = {
        "GITHUB_APP_ID": "123", "GITHUB_APP_SLUG": "linker-validation",
        "GITHUB_APP_PRIVATE_KEY": "github-app-validation-only",
        "GITHUB_WEBHOOK_SECRET": "github-webhook-validation-only",
    }
    for config in [base, production, images]:
        for key, value in github_settings.items():
            assert config["services"]["backend"]["environment"][key] == value, key
            for other in ["web", "proxy", "db", "redis"]:
                assert key not in config["services"][other].get("environment", {}), other
    # Compose reads .env only for interpolation; Spring sees just the keys listed here.
    forwarded = [
        "SESSION_COOKIE_NAME", "SESSION_COOKIE_SECURE", "SESSION_COOKIE_DOMAIN",
        "CHAT_PUBLIC_ORIGINS", "STORAGE_MODE", "STORAGE_LOCAL_DIR",
        "MAIL_HOST", "MAIL_PORT", "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM",
        "MAIL_PUBLIC_BASE_URL", "ISSUE_SYNC_ENABLED", "ISSUE_WEBHOOK_ENABLED",
        "OLLAMA_CONNECT_TIMEOUT", "OLLAMA_READ_TIMEOUT",
    ]
    for config in [base, production, images]:
        environment = config["services"]["backend"]["environment"]
        missing = [key for key in forwarded if key not in environment]
        assert not missing, f"backend does not receive {missing}"
    print("PASS: production and image-only deployment keep ports, resources and data volumes")


if __name__ == "__main__":
    main()
