"""Check the optional sidecar's isolation and app wiring without loading credentials."""

import json
import os
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]


def configuration(*files, network=None, model=None):
    env = {key: value for key, value in os.environ.items() if not key.startswith("OLLAMA_")}
    for key in ("DB_PASSWORD", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY"):
        env.pop(key, None)
    if "compose.yml" in files:
        env.update(DB_PASSWORD="validation-only", JWT_PRIVATE_KEY="validation-only", JWT_PUBLIC_KEY="validation-only")
    if network is not None:
        env["OLLAMA_DOCKER_NETWORK"] = network
    if model is not None:
        env["OLLAMA_MODEL"] = model
    command = ["docker", "compose", "--env-file", "/dev/null"]
    for path in files:
        command.extend(["-f", path])
    result = subprocess.run(command + ["config", "--format", "json"], cwd=ROOT, env=env, capture_output=True, text=True)
    return result


class OllamaConfigurationTest(unittest.TestCase):
    def test_standalone_needs_no_app_secrets_and_exposes_only_loopback(self):
        result = configuration("deploy/ollama/compose.yml")
        self.assertEqual(0, result.returncode, result.stderr)
        config = json.loads(result.stdout)
        self.assertEqual({"ollama"}, set(config["services"]))
        service = config["services"]["ollama"]
        self.assertEqual("ollama/ollama:0.40.15", service["image"])
        self.assertEqual("127.0.0.1", service["ports"][0]["host_ip"])
        self.assertEqual(11434, service["ports"][0]["target"])
        self.assertEqual("1", service["environment"]["OLLAMA_NO_CLOUD"])
        self.assertEqual("unless-stopped", service["restart"])
        self.assertEqual(service["mem_limit"], service["memswap_limit"])
        self.assertEqual("volume", service["volumes"][0]["type"])
        self.assertEqual("/root/.ollama", service["volumes"][0]["target"])
        self.assertNotIn("OLLAMA_MODEL", service["environment"])

    def test_server_joins_existing_network_without_managing_it(self):
        files = ("deploy/ollama/compose.yml", "deploy/ollama/compose.server.yml")
        missing = configuration(*files)
        self.assertNotEqual(0, missing.returncode)
        result = configuration(*files, network="linker_existing_backend")
        self.assertEqual(0, result.returncode, result.stderr)
        config = json.loads(result.stdout)
        self.assertEqual("linker_existing_backend", config["networks"]["default"]["name"])
        self.assertTrue(config["networks"]["default"]["external"])
        self.assertEqual({"ollama"}, set(config["services"]))

    def test_connection_settings_reach_only_backend_with_the_demo_model(self):
        result = configuration("compose.yml", "compose.prod.yml")
        self.assertEqual(0, result.returncode, result.stderr)
        services = json.loads(result.stdout)["services"]
        self.assertEqual({"db", "redis", "backend", "web", "proxy"}, set(services))
        self.assertEqual("http://ollama:11434", services["backend"]["environment"]["OLLAMA_BASE_URL"])
        self.assertEqual("qwen3:4b", services["backend"]["environment"]["OLLAMA_MODEL"])
        overridden = configuration("compose.yml", "compose.prod.yml", model="another-approved-model:test")
        self.assertEqual(0, overridden.returncode, overridden.stderr)
        self.assertEqual("another-approved-model:test", json.loads(overridden.stdout)["services"]["backend"]["environment"]["OLLAMA_MODEL"])
        for name in ("db", "redis", "web", "proxy"):
            self.assertFalse(any(key.startswith("OLLAMA_") for key in services[name].get("environment", {})))


if __name__ == "__main__":
    unittest.main()
