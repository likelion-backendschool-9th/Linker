#!/usr/bin/env node
/**
 * Seed + verify page-19 recruit list / my recruits / my applications against local Docker + bootRun.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
	const env = {};
	for (const raw of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
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
	if (result.status !== 0) throw new Error(result.stderr || result.stdout);
	return result.stdout.trim();
}

function b64url(input) {
	return Buffer.from(input).toString('base64url');
}

function signJwt(privatePemEscaped, claims, expiresAt) {
	const key = crypto.createPrivateKey(privatePemEscaped.replace(/\\n/g, '\n'));
	const header = { alg: 'RS256' };
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		sub: claims.subject,
		jti: crypto.randomUUID(),
		typ: claims.memberType,
		adm: false,
		onb: false,
		st: 'ACTIVE',
		iat: now,
		exp: Math.floor(expiresAt.getTime() / 1000),
	};
	const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
	return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
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
			...(state?.cookie ? { Cookie: `linker_session=${state.cookie}` } : {}),
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const renewed = cookieValue(res.headers.getSetCookie?.() ?? res.headers.get('set-cookie'));
	if (renewed && state) state.cookie = renewed;
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
const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const deadline = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

psql(`
INSERT INTO users (username, display_name, user_type, status, looking_for_team, job_seeking_status, push_enabled, created_at, updated_at)
VALUES
 ('r19_author', 'R19 Author', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}'),
 ('r19_viewer', 'R19 Viewer', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}'),
 ('r19_blocked', 'R19 Blocked', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}')
ON CONFLICT (username) DO UPDATE SET updated_at = EXCLUDED.updated_at
`);
const authorId = psql(`SELECT id FROM users WHERE username = 'r19_author'`);
const viewerId = psql(`SELECT id FROM users WHERE username = 'r19_viewer'`);
const blockedId = psql(`SELECT id FROM users WHERE username = 'r19_blocked'`);
const tagId = psql(`SELECT id FROM tech_tags WHERE name = 'TypeScript' LIMIT 1`);

psql(`
DELETE FROM applications WHERE applicant_id IN (${authorId}, ${viewerId}, ${blockedId})
  OR recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id IN (${authorId}, ${viewerId}, ${blockedId}));
DELETE FROM recruit_post_tags WHERE recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id IN (${authorId}, ${viewerId}, ${blockedId}));
DELETE FROM recruit_roles WHERE recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id IN (${authorId}, ${viewerId}, ${blockedId}));
DELETE FROM recruit_posts WHERE author_id IN (${authorId}, ${viewerId}, ${blockedId});
DELETE FROM user_blocks WHERE blocker_id IN (${authorId}, ${viewerId}, ${blockedId}) OR blocked_id IN (${authorId}, ${viewerId}, ${blockedId});
`);

psql(`
INSERT INTO recruit_posts (
  author_id, team_id, title, description, work_mode, region, goal, expected_period, deadline,
  status, visibility, sort_at, created_at, updated_at
) VALUES
 (${authorId}, null, 'R19 OPEN BACKEND', 'open visible', 'ONLINE', null, 'LEARNING', '1개월', '${deadline}',
  'OPEN', 'VISIBLE', '${now}', '${now}', '${now}'),
 (${authorId}, null, 'R19 CLOSED', 'closed', 'ONLINE', null, 'LEARNING', '1개월', '${deadline}',
  'CLOSED', 'VISIBLE', '${now}', '${now}', '${now}'),
 (${blockedId}, null, 'R19 BLOCKED AUTHOR', 'should hide when blocked', 'HYBRID', '서울', 'LAUNCH', '2개월', '${deadline}',
  'OPEN', 'VISIBLE', '${now}', '${now}', '${now}')
`);
const openId = psql(`SELECT id FROM recruit_posts WHERE title = 'R19 OPEN BACKEND' AND author_id = ${authorId}`);
const blockedPostId = psql(`SELECT id FROM recruit_posts WHERE title = 'R19 BLOCKED AUTHOR'`);

psql(`
INSERT INTO recruit_roles (recruit_post_id, role, headcount, accepted_count, created_at, updated_at)
VALUES
 (${openId}, 'BACKEND', 2, 0, '${now}', '${now}'),
 (${blockedPostId}, 'FRONTEND', 1, 0, '${now}', '${now}')
`);
const openRoleId = psql(`SELECT id FROM recruit_roles WHERE recruit_post_id = ${openId} LIMIT 1`);

psql(`
INSERT INTO recruit_post_tags (recruit_post_id, tag_id, created_at, updated_at)
VALUES (${openId}, ${tagId}, '${now}', '${now}')
ON CONFLICT DO NOTHING
`);

psql(`
INSERT INTO applications (
  recruit_post_id, recruit_role_id, applicant_id, message, status, attempt, expires_at, created_at, updated_at
) VALUES (
  ${openId}, ${openRoleId}, ${viewerId}, '목록 검증 지원', 'PENDING', 1,
  '${new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()}', '${now}', '${now}'
)
`);
const applicationId = psql(`SELECT id FROM applications WHERE applicant_id = ${viewerId} AND recruit_post_id = ${openId} ORDER BY id DESC LIMIT 1`);

function issueSession(userId) {
	const token = signJwt(env.JWT_PRIVATE_KEY, { subject: String(userId), memberType: 'DEVELOPER' }, expiresAt);
	const hash = sha256Hex(token);
	psql(`DELETE FROM user_sessions WHERE user_id = ${userId}`);
	psql(`
INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip, expires_at, created_at, updated_at)
VALUES (${userId}, '${hash}', 'local-verify-19', '127.0.0.1', '${expiresAt.toISOString()}', '${now}', '${now}')
`);
	return { cookie: token };
}

const guest = await http('GET', '/api/v1/public/recruits', null);
assert(guest.status === 200, `guest list ${guest.status}`);
assert(Array.isArray(guest.json.items), 'items');
assert(guest.json.items.every((item) => item.status === 'OPEN'), 'only OPEN');
assert(guest.json.items.some((item) => item.id === Number(openId)), 'seed open visible');
assert(!guest.json.items.some((item) => item.title === 'R19 CLOSED'), 'closed excluded');

const badSort = await http('GET', '/api/v1/public/recruits?sort=POPULAR', null);
assert(badSort.status === 400, `bad sort ${badSort.status}`);

const filtered = await http('GET', '/api/v1/public/recruits?role=BACKEND&tech=TypeScript&mode=ONLINE&sort=DEADLINE', null);
assert(filtered.status === 200, `filter ${filtered.status}`);
assert(filtered.json.items.some((item) => item.id === Number(openId)), 'filtered includes open');

psql(`
INSERT INTO user_blocks (blocker_id, blocked_id, created_at, updated_at)
VALUES (${viewerId}, ${blockedId}, '${now}', '${now}')
`);
const viewer = issueSession(viewerId);
const blockedList = await http('GET', '/api/v1/public/recruits', viewer);
assert(blockedList.status === 200, `blocked list ${blockedList.status}`);
assert(!blockedList.json.items.some((item) => item.id === Number(blockedPostId)), 'blocked author excluded');

const author = issueSession(authorId);
const mine = await http('GET', '/api/v1/user/me/recruits', author);
assert(mine.status === 200, `me recruits ${mine.status}`);
assert(
	mine.json.items.every((item) => item.author?.id === Number(authorId) || item.author?.login === 'r19_author'),
	'me/recruits must be only my posts',
);
assert(mine.json.items.some((item) => item.id === Number(openId)), 'author sees own open');

const apps = await http('GET', '/api/v1/user/me/applications?status=PENDING', viewer);
assert(apps.status === 200, `my applications ${apps.status}`);
assert(apps.json.items.some((item) => item.id === Number(applicationId)), 'pending application listed');

const cancel = await http('DELETE', `/api/v1/user/me/applications/${applicationId}`, viewer);
assert(cancel.status === 204, `cancel ${cancel.status}`);
const status = psql(`SELECT status FROM applications WHERE id = ${applicationId}`);
assert(status === 'CANCELED', `status after cancel=${status}`);
const cancelAgain = await http('DELETE', `/api/v1/user/me/applications/${applicationId}`, viewer);
assert(cancelAgain.status === 409 && cancelAgain.json?.code === 'NOT_PENDING', `cancel again ${cancelAgain.status}`);

const flyway = psql(`SELECT version FROM flyway_schema_history WHERE version = '2' AND success`);
assert(flyway === '2', `flyway v2=${flyway}`);

console.log(JSON.stringify({
	ok: true,
	openId: Number(openId),
	applicationId: Number(applicationId),
	checks: [
		'guest OPEN+VISIBLE list',
		'bad sort 400',
		'role/tech/mode/sort filter',
		'block excludes author',
		'me/recruits',
		'me/applications PENDING + cancel idempotent NOT_PENDING',
		'Flyway V2',
	],
}, null, 2));
