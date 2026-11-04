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
    print("PASS: production and image-only deployment keep ports, resources and data volumes")


if __name__ == "__main__":
    main()
