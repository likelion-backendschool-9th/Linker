"""Ensure SSH payload excludes secrets and always uses the trusted host identity."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
FAKE = '''#!/usr/bin/env python3
import json, os, pathlib, sys, tarfile
args=sys.argv[1:]
config=pathlib.Path(args[args.index('-F')+1]).read_text()
assert 'StrictHostKeyChecking yes' in config and 'IdentitiesOnly yes' in config
result={'tool':pathlib.Path(sys.argv[0]).name,'args':args}
if result['tool']=='scp':
    with tarfile.open(args[-2]) as archive: result['files']=archive.getnames()
elif 'apply.sh' in args[-1]:
    assert sys.stdin.readline().strip()=='fake-registry-token'
    result['token_received']=True
with open(os.environ['COMMAND_LOG'],'a') as output: output.write(json.dumps(result)+'\\n')
'''


class ShipTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ['ssh', 'scp']:
            path = self.root / name
            path.write_text(FAKE)
            path.chmod(0o700)
        self.log = self.root / 'commands.jsonl'
        self.env = {**os.environ, 'PATH': str(self.root) + ':' + os.environ['PATH'],
            'COMMAND_LOG': str(self.log), 'DEPLOY_HOST': 'cloud.newlecture.com',
            'DEPLOY_PORT': '22', 'DEPLOY_HOST_KEY': 'ssh-ed25519 AAAA',
            'DEPLOY_SSH_KEY': 'fake-private-key', 'GH_TOKEN': 'fake-registry-token',
            'GH_ACTOR': 'example-user', 'REPOSITORY': 'Example/Linker', 'RELEASE_SHA': 'a' * 40}

    def test_only_release_config_is_uploaded_and_token_uses_stdin(self):
        result = subprocess.run(['bash', 'deploy/ship.sh'], cwd=ROOT, env=self.env,
            stdin=subprocess.DEVNULL, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        log = self.log.read_text()
        self.assertNotIn('fake-private-key', log + result.stdout + result.stderr)
        self.assertNotIn('fake-registry-token', log + result.stdout + result.stderr)
        commands = [json.loads(line) for line in log.splitlines()]
        uploaded = next(item['files'] for item in commands if item['tool'] == 'scp')
        self.assertEqual(set(uploaded), {'compose.yml', 'compose.prod.yml', 'compose.images.yml', 'nginx/production.conf', 'deploy/apply.sh'})
        self.assertTrue(commands[-1]['token_received'])
        config = Path(commands[0]['args'][1])
        self.assertFalse(config.exists(), 'temporary private key directory must be removed')

    def test_invalid_host_is_rejected_without_ssh(self):
        self.env['DEPLOY_HOST'] = 'example;unexpected-command'
        result = subprocess.run(['bash', 'deploy/ship.sh'], cwd=ROOT, env=self.env, stdin=subprocess.DEVNULL, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.log.exists())


if __name__ == '__main__':
    unittest.main()
