"""Exercise deployment/rollback control flow without SSH, Docker or production access."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SHA = 'a' * 40
FAKE = '''#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
log = pathlib.Path(os.environ['COMMAND_LOG'])
with log.open('a') as stream: stream.write(json.dumps([pathlib.Path(sys.argv[0]).name, *args]) + '\\n')
if pathlib.Path(sys.argv[0]).name == 'curl':
    if os.environ.get('FAIL_STAGE') == 'probe':
        marker=log.parent/'probed'
        if not marker.exists(): marker.touch(); sys.exit(1)
    sys.exit(0)
if 'login' in args:
    assert sys.stdin.readline().strip() == 'temporary-test-token'
elif 'ps' in args:
    print('container-' + args[-1].split('=')[-1])
elif 'inspect' in args: print('sha256:old-image')
elif 'pull' in args and os.environ.get('FAIL_STAGE') == 'pull': sys.exit(1)
elif 'up' in args:
    rollback = any(value.endswith('rollback.yml') for value in args)
    failure = os.environ.get('FAIL_STAGE')
    if failure == 'both' or (not rollback and failure == 'apply'): sys.exit(1)
'''


class ApplyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.release = self.root / 'releases' / SHA
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for name in ['docker', 'curl']:
            script = self.bin / name
            script.write_text(FAKE)
            script.chmod(0o700)
        sudo = self.bin / 'sudo'
        sudo.write_text('#!/bin/sh\n[ "$1" = "-n" ] && shift\nexec "$@"\n')
        sudo.chmod(0o700)
        (self.root / '.env').write_text('DB_PASSWORD=synthetic-test-password\n')
        for directory in [self.root, self.release]:
            (directory / 'nginx').mkdir(parents=True, exist_ok=True)
            for name in ['compose.yml', 'compose.prod.yml']:
                (directory / name).write_text((ROOT / name).read_text())
            (directory / 'nginx/production.conf').write_text((ROOT / 'nginx/production.conf').read_text())
        (self.release / 'compose.images.yml').write_text((ROOT / 'compose.images.yml').read_text())
        # The production path is fixed; change only this test copy, never production environment.
        self.script = self.release / 'apply.sh'
        self.script.write_text((ROOT / 'deploy/apply.sh').read_text().replace('root=/home/linker/Linker', f'root={self.root}'))
        self.log = self.root / 'commands.jsonl'

    def run_apply(self, failure=''):
        return subprocess.run(['bash', str(self.script), SHA, 'ghcr.io/example/linker', 'test-user'],
            input='temporary-test-token\n', text=True, capture_output=True,
            env={**os.environ, 'PATH': str(self.bin) + ':' + os.environ['PATH'], 'COMMAND_LOG': str(self.log), 'FAIL_STAGE': failure})

    def commands(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_success_keeps_secrets_local_and_updates_application_only(self):
        result = self.run_apply()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.root / '.deployment-state/active').read_text().strip(), str(self.release))
        ups = [row for row in self.commands() if 'up' in row]
        self.assertEqual(len(ups), 1)
        self.assertEqual(ups[0][-3:], ['backend', 'web', 'proxy'])
        self.assertIn('--no-deps', ups[0])
        self.assertIn('--no-build', ups[0])
        self.assertNotIn('temporary-test-token', self.log.read_text() + result.stdout + result.stderr)
        self.assertEqual((self.root / '.env').read_text(), 'DB_PASSWORD=synthetic-test-password\n')

    def test_same_commit_can_be_deployed_twice(self):
        self.assertEqual(self.run_apply().returncode, 0)
        self.assertEqual(self.run_apply().returncode, 0)
        self.assertEqual(len(list(self.release.glob('previous.*'))), 2)

    def test_apply_failure_restores_previous_images_and_config(self):
        result = self.run_apply('apply')
        self.assertNotEqual(result.returncode, 0)
        ups = [row for row in self.commands() if 'up' in row]
        self.assertEqual(len(ups), 2)
        self.assertTrue(any(value.endswith('rollback.yml') for value in ups[1]))
        self.assertIn('Previous application restored.', result.stderr)
        active = Path((self.root / '.deployment-state/active').read_text().strip())
        self.assertTrue((active / 'nginx/production.conf').is_file())
        self.assertIn('linker-rollback/web:', (active / 'rollback.yml').read_text())

    def test_http_probe_failure_triggers_rollback(self):
        result = self.run_apply('probe')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Previous application restored.', result.stderr)

    def test_pull_failure_does_not_replace_running_containers(self):
        result = self.run_apply('pull')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any('up' in row for row in self.commands()))
        self.assertFalse((self.root / '.deployment-state/active').exists())

    def test_failed_rollback_does_not_claim_success(self):
        result = self.run_apply('both')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Rollback failed.', result.stderr)
        self.assertFalse((self.root / '.deployment-state/active').exists())

    def test_invalid_sha_is_rejected_before_docker(self):
        result = subprocess.run(['bash', str(self.script), 'bad;command', 'ghcr.io/example/linker', 'user'], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.log.exists())


if __name__ == '__main__':
    unittest.main()
