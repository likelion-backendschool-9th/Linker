#!/usr/bin/env node
/**
 * Seed local Docker DB and hit page-22 post-editor APIs against host bootRun.
 * Requires: docker db healthy, Spring on :8080, root .env with JWT keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

function loadEnv() {
	const env = {};
	for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		if (!raw || raw.startsWith('#')) continue;
		const i = raw.indexOf('=');
		if (i < 0) continue;
		let val = raw.slice(i + 1);
		if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
		env[raw.slice(0, i)] = val;
	}
	return env;
}

function psql(sql) {
	const result = spawnSync(
		'docker',
		['compose', '-f', 'compose.yml', 'exec', '-T', '-e', 'PGPASSWORD=linker_local_dev', 'db', 'psql', '-U', 'linker', '-d', 'linker', '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql],
		{ cwd: root, encoding: 'utf8' }
	);
	if (result.status !== 0) {
		throw new Error(`psql failed: ${result.stderr || result.stdout}\nSQL: ${sql}`);
	}
	return result.stdout.trim();
}

function b64url(input) {
	return Buffer.from(input).toString('base64url');
}

function signJwt(privatePemEscaped, claims, expiresAt) {
	const pem = privatePemEscaped.replace(/\\n/g, '\n');
	const key = crypto.createPrivateKey(pem);
	const header = { alg: 'RS256', typ: 'JWT' };
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		sub: claims.subject,
		jti: crypto.randomUUID(),
		typ: claims.memberType,
		adm: claims.operator,
		onb: claims.onboarded,
		st: claims.status,
		iat: now,
		exp: Math.floor(expiresAt.getTime() / 1000),
	};
	const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
	const signature = crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url');
	return `${data}.${signature}`;
}

function sha256Hex(raw) {
	return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function cookieValue(setCookie) {
	if (!setCookie) return null;
	const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
	const match = /(?:^|, )linker_session=([^;]+)/.exec(` ${first}`);
	return match ? match[1] : null;
}

async function http(method, urlPath, state, { body } = {}) {
	const res = await fetch(`http://127.0.0.1:8080${urlPath}`, {
		method,
		headers: {
			...(state.cookie ? { Cookie: `linker_session=${state.cookie}` } : {}),
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const renewed = cookieValue(res.headers.getSetCookie?.() ?? res.headers.get('set-cookie'));
	if (renewed) {
		state.cookie = renewed;
	}
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = text;
	}
	return { status: res.status, json };
}

function assert(cond, message) {
	if (!cond) throw new Error(message);
}

const env = loadEnv();
const now = new Date().toISOString();

psql(`
INSERT INTO users (username, display_name, user_type, status, looking_for_team, job_seeking_status, push_enabled, created_at, updated_at)
VALUES ('dev', 'Dev', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}')
ON CONFLICT (username) DO UPDATE SET updated_at = EXCLUDED.updated_at
`);
const userId = psql(`SELECT id FROM users WHERE username = 'dev'`);

psql(`
INSERT INTO github_repos (
  github_repo_id, owner_login, name, full_name, description, primary_language,
  stargazers_count, forks_count, html_url, is_private, is_fork, parent_full_name,
  default_branch, metadata_synced_at, deleted_at, created_at, updated_at
) VALUES
  (1001, 'dev', 'linker-web', 'dev/linker-web', 'owned public', 'TypeScript', 3, 1, 'https://github.com/dev/linker-web', false, false, null, 'main', '${now}', null, '${now}', '${now}'),
  (1002, 'dev', 'secret', 'dev/secret', 'owned private', 'TypeScript', 0, 0, 'https://github.com/dev/secret', true, false, null, 'main', '${now}', null, '${now}', '${now}'),
  (1003, 'other', 'other-web', 'other/other-web', 'foreign public', 'Go', 9, 2, 'https://github.com/other/other-web', false, false, null, 'main', '${now}', null, '${now}', '${now}')
ON CONFLICT (github_repo_id) DO UPDATE SET
  owner_login = EXCLUDED.owner_login,
  full_name = EXCLUDED.full_name,
  is_private = EXCLUDED.is_private,
  updated_at = EXCLUDED.updated_at
`);

const ownedRepoId = psql(`SELECT id FROM github_repos WHERE full_name = 'dev/linker-web'`);
const foreignRepoId = psql(`SELECT id FROM github_repos WHERE full_name = 'other/other-web'`);

// Match PlanLimits.SESSION_DAYS so the first authenticated call does not rotate the cookie.
const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const token = signJwt(env.JWT_PRIVATE_KEY, {
	subject: String(userId),
	memberType: 'DEVELOPER',
	operator: false,
	onboarded: false,
	status: 'ACTIVE',
}, expiresAt);
const tokenHash = sha256Hex(token);
const state = { cookie: token };

psql(`DELETE FROM user_sessions WHERE user_id = ${userId}`);
psql(`
INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip, expires_at, created_at, updated_at)
VALUES (${userId}, '${tokenHash}', 'local-verify', '127.0.0.1', '${expiresAt.toISOString()}', '${now}', '${now}')
`);

const unauth = await http('GET', '/api/v1/user/post-editor/repos', { cookie: null });
assert(unauth.status === 401, `expected 401 without cookie, got ${unauth.status}`);

const list = await http('GET', '/api/v1/user/post-editor/repos', state);
assert(list.status === 200, `listRepos status ${list.status} ${JSON.stringify(list.json)}`);
assert(Array.isArray(list.json.items), 'list items missing');
assert(list.json.items.length === 1, `expected 1 public owned repo, got ${list.json.items.length}`);
assert(list.json.items[0].fullName === 'dev/linker-web', 'unexpected repo');
assert(list.json.items[0].alreadyPosted === false, 'alreadyPosted should be false');

const teamList = await http('GET', '/api/v1/user/post-editor/repos?teamId=1', state);
assert(
	teamList.status === 200 && Array.isArray(teamList.json?.items) && teamList.json.items.length === 0,
	`teamId stub should be empty: status=${teamList.status} body=${JSON.stringify(teamList.json)}`
);

const summaryOk = await http('GET', `/api/v1/user/post-editor/repos/${ownedRepoId}/summary`, state);
assert(summaryOk.status === 200, `owned summary ${summaryOk.status}`);
assert(summaryOk.json.fullName === 'dev/linker-web', 'summary fullName');

const summaryForeign = await http('GET', `/api/v1/user/post-editor/repos/${foreignRepoId}/summary`, state);
assert(summaryForeign.status === 404, `foreign summary expected 404 got ${summaryForeign.status}`);

const createForeign = await http('POST', '/api/v1/user/posts', state, {
	body: {
		repoId: Number(foreignRepoId),
		intro: '남의 레포 게시 시도',
		body: '본문',
		photos: [],
		myRole: null,
		demoLinks: [],
		period: null,
		teamSize: null,
		tags: [],
	},
});
assert(createForeign.status === 404, `foreign create expected 404 got ${createForeign.status}`);

// Clear leftover posts from earlier failed runs so create can succeed.
psql(`
DELETE FROM post_tags WHERE post_id IN (SELECT id FROM posts WHERE author_id = ${userId});
DELETE FROM post_demo_links WHERE post_id IN (SELECT id FROM posts WHERE author_id = ${userId});
DELETE FROM post_images WHERE post_id IN (SELECT id FROM posts WHERE author_id = ${userId});
DELETE FROM posts WHERE author_id = ${userId};
`);

const createOk = await http('POST', '/api/v1/user/posts', state, {
	body: {
		repoId: Number(ownedRepoId),
		intro: '로컬 검증용 한 줄 소개',
		body: '로컬 DB 연결 검증 본문',
		photos: [],
		myRole: 'Backend',
		demoLinks: ['https://example.com'],
		period: { start: '2026-01', end: '2026-03' },
		teamSize: 3,
		tags: [],
	},
});
assert(createOk.status === 201, `create expected 201 got ${createOk.status} ${JSON.stringify(createOk.json)}`);
const postId = createOk.json.id;
assert(postId, 'post id missing');

const duplicate = await http('POST', '/api/v1/user/posts', state, {
	body: {
		repoId: Number(ownedRepoId),
		intro: '중복 게시',
		body: '',
		photos: [],
		demoLinks: [],
		tags: [],
	},
});
assert(duplicate.status === 409 && duplicate.json.code === 'REPO_ALREADY_POSTED', `duplicate expected 409 got ${duplicate.status}`);

const editForm = await http('GET', `/api/v1/user/posts/${postId}/edit-form`, state);
assert(editForm.status === 200, `edit-form ${editForm.status}`);
assert(editForm.json.intro === '로컬 검증용 한 줄 소개', 'edit-form intro');

const update = await http('PUT', `/api/v1/user/posts/${postId}`, state, {
	body: {
		repoId: Number(ownedRepoId),
		intro: '수정된 한 줄 소개입니다',
		body: '수정 본문',
		photos: [],
		myRole: 'Backend',
		demoLinks: ['https://example.com'],
		period: { start: '2026-01', end: '2026-03' },
		teamSize: 4,
		tags: [],
	},
});
assert(update.status === 200, `update ${update.status}`);

const edited = psql(`SELECT summary, edited_at IS NOT NULL AS edited FROM posts WHERE id = ${postId}`);
assert(edited.startsWith('수정된 한 줄 소개입니다|t') || edited.includes('수정된 한 줄 소개입니다'), `db summary/edited mismatch: ${edited}`);

// Soft-delete then republish must work with partial unique index
psql(`UPDATE posts SET deleted_at = '${now}', updated_at = '${now}' WHERE id = ${postId}`);
const recreate = await http('POST', '/api/v1/user/posts', state, {
	body: {
		repoId: Number(ownedRepoId),
		intro: '삭제 후 재게시 소개글',
		body: '재게시',
		photos: [],
		demoLinks: [],
		tags: [],
	},
});
assert(recreate.status === 201, `recreate after soft-delete expected 201 got ${recreate.status} ${JSON.stringify(recreate.json)}`);

console.log(JSON.stringify({
	ok: true,
	userId: Number(userId),
	ownedRepoId: Number(ownedRepoId),
	postId,
	recreatedPostId: recreate.json.id,
	checks: [
		'401 without cookie',
		'listRepos filters private/foreign',
		'teamId empty stub',
		'owned summary 200 / foreign 404',
		'create ownership + duplicate 409',
		'edit-form/update',
		'soft-delete republish via partial UK',
	],
}, null, 2));
