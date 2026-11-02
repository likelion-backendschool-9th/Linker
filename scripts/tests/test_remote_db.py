"""Common DB helper tests. No real SSH, server, database or passwords are used."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import remote_db

COMMON = json.loads((remote_db.ROOT / 'config/remote-db.json').read_text())


class RemoteDbTests(unittest.TestCase):
    def test_personal_values_are_literal_and_environment_can_override_username(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env.remote-db'
            path.write_text("DB_PASSWORD='literal $value #value'\nDB_USERNAME=linker\n")
            with patch.dict(os.environ, {'DB_USERNAME': 'personal-user'}, clear=True):
                values = remote_db.personal_settings(path)
            self.assertEqual(values['DB_PASSWORD'], 'literal $value #value')
            self.assertEqual(values['DB_USERNAME'], 'personal-user')

    def test_invalid_settings_do_not_include_value_in_error(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env.remote-db'
            path.write_text('UNKNOWN=synthetic-secret\n')
            with self.assertRaises(ValueError) as result:
                remote_db.personal_settings(path)
            self.assertNotIn('synthetic-secret', str(result.exception))

    def test_current_container_ip_is_resolved_instead_of_hardcoded(self):
        result = subprocess.CompletedProcess([], 0, stdout=json.dumps({'linker_default': {'IPAddress': '172.18.0.99'}}))
        with patch.object(subprocess, 'run', return_value=result) as run:
            address = remote_db.discover_ip(COMMON, ['ssh'], 'linker@example.com')
        self.assertEqual(address, '172.18.0.99')
        self.assertIn('sudo -n docker inspect', run.call_args.args[0][-1])

    def test_ambiguous_networks_are_rejected(self):
        result = subprocess.CompletedProcess([], 0, stdout=json.dumps({'one': {'IPAddress': '172.18.0.1'}, 'two': {'IPAddress': '172.19.0.1'}}))
        with patch.object(subprocess, 'run', return_value=result):
            with self.assertRaises(ValueError):
                remote_db.discover_ip(COMMON, ['ssh'], 'linker@example.com')

    def test_host_key_verification_is_kept_and_password_is_not_an_argument(self):
        command, target = remote_db.ssh_command(COMMON, {'DB_PASSWORD': 'synthetic-secret'})
        self.assertIn('StrictHostKeyChecking=yes', command)
        self.assertNotIn('synthetic-secret', ' '.join(command))
        self.assertEqual(target, 'linker@cloud.newlecture.com')

    def test_injection_in_remote_container_name_is_rejected(self):
        with patch.object(subprocess, 'run') as run:
            with self.assertRaises(ValueError):
                remote_db.discover_ip({**COMMON, 'db_container': 'db;bad'}, ['ssh'], 'linker@example.com')
        run.assert_not_called()

    def test_backend_uses_tunnel_personal_account_and_disables_automatic_ddl(self):
        with patch.dict(os.environ, {'SPRING_JPA_HIBERNATE_DDL_AUTO': 'create-drop'}, clear=True):
            env = remote_db.backend_environment(COMMON, {'DB_USERNAME': 'personal-user'}, 15433, 'synthetic-secret')
        self.assertEqual(env['DB_URL'], 'jdbc:postgresql://127.0.0.1:15433/linker')
        self.assertEqual(env['DB_USERNAME'], 'personal-user')
        self.assertEqual(env['DB_PASSWORD'], 'synthetic-secret')
        self.assertEqual(env['SPRING_JPA_HIBERNATE_DDL_AUTO'], 'none')
        self.assertEqual(env['SPRING_SQL_INIT_MODE'], 'never')

    def test_closed_tunnel_fails_without_claiming_db_ready(self):
        tunnel = Mock()
        tunnel.poll.return_value = 255
        with self.assertRaises(ValueError):
            remote_db.wait_for_postgres(tunnel, 15432)

    def test_tcp_listening_is_not_enough_postgresql_protocol_is_checked(self):
        tunnel = Mock()
        tunnel.poll.return_value = None
        connection = Mock()
        connection.recv.return_value = b'N'
        context = Mock()
        context.__enter__ = Mock(return_value=connection)
        context.__exit__ = Mock(return_value=False)
        with patch.object(remote_db.socket, 'create_connection', return_value=context):
            remote_db.wait_for_postgres(tunnel, 15432)
        connection.sendall.assert_called_once_with(b'\x00\x00\x00\x08\x04\xd2\x16/')

    def test_probe_failure_always_closes_owned_tunnel(self):
        tunnel = Mock()
        tunnel.poll.return_value = None
        with patch.object(sys, 'argv', ['remote_db.py', 'tunnel']), \
             patch.object(remote_db, 'personal_settings', return_value={}), \
             patch.object(remote_db, 'ensure_free_port'), \
             patch.object(remote_db, 'discover_ip', return_value='172.18.0.3'), \
             patch.object(remote_db, 'wait_for_postgres', side_effect=ValueError('synthetic failure')), \
             patch.object(subprocess, 'Popen', return_value=tunnel), \
             contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(ValueError):
                remote_db.main()
        tunnel.terminate.assert_called_once()
        tunnel.wait.assert_called_once_with(timeout=5)

    def test_backend_is_stopped_when_tunnel_disconnects(self):
        tunnel, backend = Mock(), Mock()
        tunnel.poll.return_value = 255
        backend.poll.return_value = None
        with patch.object(sys, 'argv', ['remote_db.py', 'backend']), \
             patch.object(remote_db, 'personal_settings', return_value={'DB_PASSWORD': 'synthetic-secret'}), \
             patch.object(remote_db, 'ensure_free_port'), \
             patch.object(remote_db, 'discover_ip', return_value='172.18.0.3'), \
             patch.object(remote_db, 'wait_for_postgres'), \
             patch.object(remote_db.shutil, 'which', return_value='/usr/bin/tool'), \
             patch.object(subprocess, 'Popen', side_effect=[tunnel, backend]) as start, \
             contextlib.redirect_stdout(io.StringIO()) as output:
            with self.assertRaises(ValueError):
                remote_db.main()
        backend.terminate.assert_called_once()
        self.assertNotIn('synthetic-secret', output.getvalue())
        self.assertNotIn('synthetic-secret', ' '.join(start.call_args_list[1].args[0]))
        self.assertEqual(start.call_args_list[1].kwargs['env']['DB_PASSWORD'], 'synthetic-secret')


if __name__ == '__main__':
    unittest.main()
