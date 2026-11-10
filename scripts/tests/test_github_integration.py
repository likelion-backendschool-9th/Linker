"""Security/isolation regressions for the shared local integration runner. No real credentials."""
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

RUNNER = Path(__file__).resolve().parents[1] / "github-integration/run.py"
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("github_integration", RUNNER)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class GithubIntegrationSafetyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.settings = {**runner.PORTS, "DB_PASSWORD": "private-database-test-value",
                         "JWT_PRIVATE_KEY": "private-session-test-value", "JWT_PUBLIC_KEY": "public\\nkey",
                         "GITHUB_WEBHOOK_SECRET": "private-webhook-test-value",
                         "GITHUB_TOKEN_ENCRYPTION_KEY": "private-encryption-test-value",
                         **{key: "private-app-test-value" for key in runner.APP_KEYS}}

    def tearDown(self):
        self.temp.cleanup()

    def write_settings(self):
        runner.private_write(self.directory / ".env", "".join(k + "=" + v + "\n" for k, v in self.settings.items()))

    def test_web_child_receives_no_private_settings_or_parent_credentials(self):
        with patch.dict(os.environ, {"GH_TOKEN": "parent-github-secret", "DB_PASSWORD": "parent-db-secret",
                                     "GITHUB_APP_PRIVATE_KEY": "parent-key", "AWS_SECRET_ACCESS_KEY": "parent-aws-secret"}):
            child = runner.web_environment(self.settings)
        serialized = json.dumps(child)
        self.assertNotIn("private-", serialized)
        self.assertNotIn("parent-", serialized)
        self.assertNotIn("JWT_PRIVATE_KEY", child)
        self.assertEqual(child["JWT_PUBLIC_KEY"], "public\nkey")
        self.assertEqual(child["NEXT_PUBLIC_USE_MOCKS"], "false")

    def test_backend_ignores_remote_db_and_provider_overrides(self):
        self.settings.update(DB_URL="jdbc:postgresql://shared-server/production",
                             REDIS_HOST="shared-server", SERVER_ADDRESS="0.0.0.0",
                             GITHUB_WEB_BASE_URL="https://untrusted.invalid",
                             GITHUB_API_BASE_URL="https://untrusted.invalid")
        child = runner.backend_environment(self.directory, self.settings)
        self.assertEqual(child["DB_URL"], "jdbc:postgresql://127.0.0.1:55432/linker_github_test")
        self.assertEqual(child["REDIS_HOST"], "127.0.0.1")
        self.assertEqual(child["SERVER_ADDRESS"], "127.0.0.1")
        self.assertEqual(child["GITHUB_WEB_BASE_URL"], "https://github.com")
        self.assertEqual(child["GITHUB_API_BASE_URL"], "https://api.github.com")
        self.assertEqual(child["ISSUE_WEBHOOK_ENABLED"], "false")

    def test_docker_environment_does_not_receive_github_or_session_credentials(self):
        child = runner.compose_environment(self.settings)
        self.assertNotIn("GITHUB_APP_PRIVATE_KEY", child)
        self.assertNotIn("JWT_PRIVATE_KEY", child)
        self.assertNotIn("GITHUB_TOKEN_ENCRYPTION_KEY", child)
        self.assertEqual(child["DB_PASSWORD"], self.settings["DB_PASSWORD"])

    def test_remote_docker_refused_before_compose_runs(self):
        with patch.dict(os.environ, {"DOCKER_HOST": "ssh://remote-server", "DOCKER_CONTEXT": ""}):
            with patch.object(runner.subprocess, "run") as run:
                with self.assertRaises(runner.SetupError):
                    runner.compose(self.directory, self.settings, "up", "-d")
                run.assert_not_called()

    def test_docker_failure_does_not_print_provider_output_or_put_password_in_arguments(self):
        failed = subprocess.CompletedProcess([], 1, stdout="private-provider-output", stderr="private-db-secret")
        with patch.object(runner, "require_local_docker"):
            with patch.object(runner.subprocess, "run", return_value=failed) as run:
                with self.assertRaises(runner.SetupError) as caught:
                    runner.compose(self.directory, self.settings, "up", "-d")
        self.assertNotIn("private-", str(caught.exception))
        self.assertNotIn(self.settings["DB_PASSWORD"], json.dumps(run.call_args.args[0]))

    def test_existing_file_or_symlink_is_never_overwritten(self):
        target = self.directory / "target"
        target.write_text("original")
        path = self.directory / ".env"
        path.symlink_to(target)
        with self.assertRaises(FileExistsError):
            runner.private_write(path, "replacement")
        self.assertEqual(target.read_text(), "original")
        with self.assertRaises(runner.SetupError):
            runner.load_settings(self.directory)

    def test_private_file_mode_and_strict_env_loading(self):
        self.write_settings()
        self.assertEqual(stat.S_IMODE((self.directory / ".env").stat().st_mode), 0o600)
        self.assertEqual(runner.load_settings(self.directory)["DB_PASSWORD"], self.settings["DB_PASSWORD"])
        with (self.directory / ".env").open("a") as stream:
            stream.write("DB_PASSWORD=another-value\n")
        with self.assertRaises(runner.SetupError):
            runner.load_settings(self.directory)

    def test_bad_port_and_nonprivate_env_are_refused(self):
        self.settings["TEST_DB_PORT"] = "55432; echo unsafe"
        self.write_settings()
        with self.assertRaises(runner.SetupError):
            runner.load_settings(self.directory)
        if os.name == "posix":
            (self.directory / ".env").chmod(0o644)
            with self.assertRaises(runner.SetupError):
                runner.load_settings(self.directory)

    def test_state_directory_rejects_escape_absolute_path_and_symlink(self):
        for path in ("/tmp/elsewhere", ".local-notes/../elsewhere", "shared-settings"):
            with self.assertRaises(runner.SetupError):
                runner.state_directory(path)
        with patch.object(runner, "ROOT", self.directory):
            (self.directory / ".local-notes").symlink_to(self.directory)
            with self.assertRaises(runner.SetupError):
                runner.state_directory(".local-notes/test")

    def test_sync_requires_matching_schema_and_all_app_fields(self):
        with self.assertRaises(runner.SetupError):
            runner.backend_environment(self.directory, self.settings, True)
        with patch.object(runner, "schema_matches", return_value=True):
            self.settings["GITHUB_APP_CLIENT_SECRET"] = ""
            with self.assertRaises(runner.SetupError):
                runner.backend_environment(self.directory, self.settings, True)

    def test_build_process_does_not_receive_backend_credentials(self):
        args = SimpleNamespace(command="backend", enable_sync=False, build=True)
        jar = self.directory / "backend/build/libs/test-SNAPSHOT.jar"
        jar.parent.mkdir(parents=True)
        jar.touch()
        with patch.object(runner, "ROOT", self.directory):
            with patch.object(runner.subprocess, "run") as build:
                with patch.object(runner.os, "chdir"):
                    with patch.object(runner.os, "execvpe", side_effect=RuntimeError("intercepted launch")) as launch:
                        with self.assertRaises(RuntimeError):
                            runner.launch(args, self.directory, self.settings)
        build_env = build.call_args.kwargs["env"]
        runtime_env = launch.call_args.args[2]
        self.assertNotIn("GITHUB_APP_PRIVATE_KEY", build_env)
        self.assertNotIn("DB_PASSWORD", build_env)
        self.assertNotIn("JWT_PRIVATE_KEY", build_env)
        self.assertEqual(runtime_env["GITHUB_APP_PRIVATE_KEY"], self.settings["GITHUB_APP_PRIVATE_KEY"])

    def test_preparation_refuses_until_flyway_created_team_and_issue_tables(self):
        with patch.object(runner, "database", side_effect=["linker_github_test", "f"]) as database:
            with self.assertRaises(runner.SetupError):
                runner.prepare_schema(self.directory, self.settings)
        self.assertEqual(database.call_count, 2)
        self.assertFalse((self.directory / "schema.json").exists())

    def test_preparation_only_reads_flyway_state_and_applies_no_sql(self):
        history = "\n".join(p.name.split("__")[0][1:]
                            for p in (runner.SQL_ROOT / "migration").glob("V*__*.sql"))
        self.assertIn("22", history.splitlines())
        with patch.object(runner, "database", side_effect=["linker_github_test", "t", history]) as database:
            runner.prepare_schema(self.directory, self.settings)
        self.assertEqual(database.call_count, 3)
        for call in database.call_args_list:
            sql = call.args[2]
            self.assertTrue(sql.lstrip().upper().startswith("SELECT"))
            self.assertNotIn("CREATE TABLE", sql)
        self.assertTrue(runner.schema_matches(self.directory))

    def test_stale_flyway_history_is_refused_without_marker(self):
        with patch.object(runner, "database", side_effect=["linker_github_test", "t", "1\n2"]) as database:
            with self.assertRaises(runner.SetupError):
                runner.prepare_schema(self.directory, self.settings)
        self.assertEqual(database.call_count, 3)
        self.assertFalse((self.directory / "schema.json").exists())

    def test_marker_from_old_prepared_sql_no_longer_matches(self):
        (self.directory / "schema.json").write_text(json.dumps({"issue-schema/issue-cache.sql": "old"}))
        self.assertFalse(runner.schema_matches(self.directory))

    def test_invalid_delivery_identifier_never_reaches_sql(self):
        with patch.object(runner, "database") as database:
            with self.assertRaises(ValueError):
                runner.verify_delivery(self.directory, self.settings, "x'; DROP TABLE users; --")
            database.assert_not_called()

    def test_init_preserves_existing_configuration_and_keys(self):
        self.write_settings()
        original = (self.directory / ".env").read_bytes()
        with patch.object(runner, "ROOT", self.directory.parent):
            with patch.object(runner.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)):
                with self.assertRaises(runner.SetupError):
                    runner.init(self.directory)
        self.assertEqual((self.directory / ".env").read_bytes(), original)

    def test_init_rejects_directory_not_ignored_by_git(self):
        with patch.object(runner, "ROOT", self.directory.parent):
            with patch.object(runner.subprocess, "run", return_value=subprocess.CompletedProcess([], 1)):
                with self.assertRaises(runner.SetupError):
                    runner.init(self.directory)
        self.assertFalse((self.directory / ".env").exists())

    def test_http_client_does_not_forward_signature_to_redirect_target(self):
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        from threading import Thread

        class Redirect(BaseHTTPRequestHandler):
            requests = []

            def log_message(self, *_):
                pass

            def do_GET(self):
                self.requests.append(self.path)
                self.send_response(302 if self.path == "/redirect" else 200)
                self.send_header("Location", "/must-not-receive-signature")
                self.end_headers()

        server = ThreadingHTTPServer(("127.0.0.1", 0), Redirect)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            settings = {**self.settings, "TEST_BACKEND_PORT": str(server.server_port)}
            self.assertEqual(runner.http(settings, "/redirect", headers={"X-Hub-Signature-256": "private-signature"}), 302)
            self.assertEqual(Redirect.requests, ["/redirect"])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
