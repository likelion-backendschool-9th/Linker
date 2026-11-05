#!/usr/bin/env node
/**
 * Local helper: write compose-safe root .env JWT keys and boot Spring against Docker DB.
 * Not for production. Do not commit generated .env.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const backend = path.join(root, 'backend');

function run(cmd, args, opts = {}) {
	const result = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
	if (result.status !== 0) {
		throw new Error(`${cmd} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
	}
	return result.stdout;
}

function pemToEscaped(pemPath) {
	return fs.readFileSync(pemPath, 'utf8').trim().replace(/\r?\n/g, '\\n');
}

function writeEnv(privEscaped, pubEscaped) {
	const body = [
		'# Local Docker / host Spring — do not commit',
		'DB_URL=jdbc:postgresql://localhost:5500/linker',
		'DB_USERNAME=linker',
		'DB_PASSWORD=linker_local_dev',
		'',
		'REDIS_HOST=localhost',
		'REDIS_PORT=6379',
		'',
		'PROXY_PORT=8000',
		'NEXT_PUBLIC_SITE_URL=http://localhost:3000',
		'NEXT_PUBLIC_IMAGE_HOST=',
		'NEXT_PUBLIC_WS_URL=',
		'NEXT_PUBLIC_TOSS_CLIENT_KEY=',
		'TOSS_SECRET_KEY=',
		'TOSS_CLIENT_KEY=',
		'TOSS_API_BASE_URL=https://api.tosspayments.com',
		'',
		'GITHUB_WEBHOOK_SECRET=',
		'GITHUB_APP_ID=',
		'GITHUB_APP_SLUG=',
		'GITHUB_APP_PRIVATE_KEY=',
		'GITHUB_API_BASE_URL=https://api.github.com',
		'GITHUB_API_VERSION=2026-03-10',
		'GITHUB_HTTP_TIMEOUT=10s',
		'GITHUB_INSTALL_STATE_TTL=10m',
		'GITHUB_WEBHOOK_MAX_ATTEMPTS=5',
		'GITHUB_WEBHOOK_RETRY_DELAY=30s',
		'GITHUB_WEBHOOK_RECEIVED_TIMEOUT=60s',
		'GITHUB_WEBHOOK_RECOVERY_BATCH_SIZE=100',
		'GITHUB_WEBHOOK_RECOVERY_DELAY_MS=60000',
		'',
		`JWT_PRIVATE_KEY="${privEscaped}"`,
		`JWT_PUBLIC_KEY="${pubEscaped}"`,
		'',
		'SESSION_COOKIE_NAME=linker_session',
		'SESSION_COOKIE_SECURE=false',
		'SESSION_COOKIE_DOMAIN=',
		'ALLOWED_ORIGINS=',
		'',
		'STORAGE_MODE=unconfigured',
		'STORAGE_LOCAL_DIR=',
		'',
	].join('\n');
	fs.writeFileSync(envPath, body, { mode: 0o600 });
}

function loadEnvFile() {
	const env = { ...process.env };
	for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		if (!raw || raw.startsWith('#')) continue;
		const i = raw.indexOf('=');
		if (i < 0) continue;
		const key = raw.slice(0, i);
		let val = raw.slice(i + 1);
		if (val.startsWith('"') && val.endsWith('"')) {
			val = val.slice(1, -1);
		}
		env[key] = val;
	}
	return env;
}

function envHasUsableJwt() {
	if (!fs.existsSync(envPath)) {
		return false;
	}
	try {
		const env = loadEnvFile();
		return Boolean(
			env.JWT_PRIVATE_KEY?.startsWith('-----BEGIN PRIVATE KEY-----')
			&& env.JWT_PRIVATE_KEY.includes('\\n')
			&& env.JWT_PUBLIC_KEY?.startsWith('-----BEGIN PUBLIC KEY-----')
			&& env.DB_PASSWORD
		);
	} catch {
		return false;
	}
}

function ensureKeys() {
	if (envHasUsableJwt()) {
		console.log('reusing existing .env JWT keys');
		return;
	}
	const tmp = fs.mkdtempSync(path.join(root, '.tmp-jwt-'));
	const privPath = path.join(tmp, 'private.pem');
	const pubPath = path.join(tmp, 'public.pem');
	try {
		run('openssl', ['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048', '-out', privPath]);
		run('openssl', ['rsa', '-in', privPath, '-pubout', '-out', pubPath]);
		const priv = pemToEscaped(privPath);
		const pub = pemToEscaped(pubPath);
		if (!priv.includes('\\n') || !priv.startsWith('-----BEGIN PRIVATE KEY-----')) {
			throw new Error('private PEM escape failed');
		}
		writeEnv(priv, pub);
		const lines = fs.readFileSync(envPath, 'utf8').split(/\n/);
		const privLine = lines.find((line) => line.startsWith('JWT_PRIVATE_KEY='));
		if (!privLine || privLine.length < 500 || !privLine.includes('\\n')) {
			throw new Error(`JWT line malformed (len=${privLine?.length ?? 0})`);
		}
		console.log(`wrote .env jwt_private_line_len=${privLine.length}`);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
}

ensureKeys();
const env = loadEnvFile();
if (!env.JWT_PRIVATE_KEY?.startsWith('-----BEGIN PRIVATE KEY-----') || !env.JWT_PRIVATE_KEY.includes('\\n')) {
	throw new Error('JWT_PRIVATE_KEY failed to load from .env');
}
console.log(`jwt_loaded len=${env.JWT_PRIVATE_KEY.length}`);

const isWin = process.platform === 'win32';
const child = spawn(isWin ? 'gradlew.bat' : './gradlew', ['bootRun', '--no-daemon'], {
	cwd: backend,
	env,
	stdio: 'inherit',
	shell: isWin,
});
child.on('exit', (code) => process.exit(code ?? 1));
