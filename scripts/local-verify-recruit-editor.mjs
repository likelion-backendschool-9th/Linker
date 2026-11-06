#!/usr/bin/env node
/**
 * Seed + verify page-20 recruit editor create/edit/close/reopen/delete against local Docker + bootRun.
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
const deadline = new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().slice(0, 10);

psql(`
INSERT INTO users (username, display_name, user_type, status, looking_for_team, job_seeking_status, push_enabled, created_at, updated_at)
VALUES
 ('r20_author', 'R20 Author', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}'),
 ('r20_other', 'R20 Other', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}')
ON CONFLICT (username) DO UPDATE SET updated_at = EXCLUDED.updated_at
`);
const authorId = psql(`SELECT id FROM users WHERE username = 'r20_author'`);
const otherId = psql(`SELECT id FROM users WHERE username = 'r20_other'`);

psql(`
DELETE FROM applications WHERE recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id IN (${authorId}, ${otherId}));
DELETE FROM recruit_post_tags WHERE recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id IN (${authorId}, ${otherId}));
DELETE FROM recruit_roles WHERE recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id IN (${authorId}, ${otherId}));
DELETE FROM recruit_posts WHERE author_id IN (${authorId}, ${otherId});
`);

function issueSession(userId) {
	const token = signJwt(env.JWT_PRIVATE_KEY, { subject: String(userId), memberType: 'DEVELOPER' }, expiresAt);
	const hash = sha256Hex(token);
	psql(`DELETE FROM user_sessions WHERE user_id = ${userId}`);
	psql(`
INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip, expires_at, created_at, updated_at)
VALUES (${userId}, '${hash}', 'local-verify-20', '127.0.0.1', '${expiresAt.toISOString()}', '${now}', '${now}')
`);
	return { cookie: token };
}

function writeBody(overrides = {}) {
	return {
		title: 'R20 에디터 검증 모집',
		intro: '작성·수정 로컬 검증용 소개입니다.',
		roles: [{ id: null, role: 'BACKEND', headcount: 2 }],
		format: 'ONLINE',
		region: null,
		goal: 'LEARNING',
		duration: '2개월',
		deadline,
		techTags: ['TypeScript'],
		teamId: null,
		...overrides,
	};
}

const author = issueSession(authorId);
const other = issueSession(otherId);

const options = await http('GET', '/api/v1/user/recruit-editor/options', author);
assert(options.status === 200, `options ${options.status}`);
assert(Array.isArray(options.json.teams), 'teams array (empty stub ok)');
assert(typeof options.json.openCount === 'number', 'openCount');
assert(options.json.openLimit >= 3, 'openLimit');
assert(options.json.maxDeadlineDate, 'maxDeadlineDate');

const create = await http('POST', '/api/v1/user/recruits', author, { body: writeBody() });
assert(create.status === 201, `create ${create.status} ${JSON.stringify(create.json)}`);
const recruitId = create.json.id;
assert(recruitId, 'recruit id');

const form = await http('GET', `/api/v1/user/recruits/${recruitId}/edit-form`, author);
assert(form.status === 200, `edit-form ${form.status}`);
assert(form.json.title === 'R20 에디터 검증 모집', 'edit-form title');
const roleId = form.json.roles[0].id;

const update = await http('PUT', `/api/v1/user/recruits/${recruitId}`, author, {
	body: writeBody({
		title: 'R20 수정된 모집 제목',
		intro: '수정된 소개입니다.',
		roles: [{ id: roleId, role: 'BACKEND', headcount: 3 }],
		techTags: ['TypeScript', 'Java'],
	}),
});
assert(update.status === 200, `update ${update.status} ${JSON.stringify(update.json)}`);
const titleDb = psql(`SELECT title FROM recruit_posts WHERE id = ${recruitId}`);
assert(titleDb === 'R20 수정된 모집 제목', `db title=${titleDb}`);

const foreignClose = await http('POST', `/api/v1/user/recruits/${recruitId}/close`, other);
assert(foreignClose.status === 403 || foreignClose.status === 404, `foreign close ${foreignClose.status}`);

const close = await http('POST', `/api/v1/user/recruits/${recruitId}/close`, author);
assert(close.status === 204 || close.status === 200, `close ${close.status}`);
const closedStatus = psql(`SELECT status FROM recruit_posts WHERE id = ${recruitId}`);
assert(closedStatus === 'CLOSED', `closed status=${closedStatus}`);
const listClosed = await http('GET', '/api/v1/public/recruits', null);
assert(!listClosed.json.items.some((item) => item.id === recruitId), 'closed not in public list');

const reopen = await http('POST', `/api/v1/user/recruits/${recruitId}/reopen`, author);
assert(reopen.status === 204 || reopen.status === 200, `reopen ${reopen.status}`);
const reopenStatus = psql(`SELECT status FROM recruit_posts WHERE id = ${recruitId}`);
assert(reopenStatus === 'OPEN', `reopen status=${reopenStatus}`);

const del = await http('DELETE', `/api/v1/user/recruits/${recruitId}`, author);
assert(del.status === 204, `delete ${del.status}`);
const deleted = psql(`SELECT deleted_at IS NOT NULL FROM recruit_posts WHERE id = ${recruitId}`);
assert(deleted === 't', `deleted_at set=${deleted}`);
const detailGone = await http('GET', `/api/v1/public/recruits/${recruitId}`, null);
assert(detailGone.status === 404, `deleted detail ${detailGone.status}`);

console.log(JSON.stringify({
	ok: true,
	recruitId,
	checks: [
		'editor options',
		'create 201',
		'edit-form + put',
		'non-author close forbidden',
		'close → public hide → reopen',
		'delete soft + detail 404',
	],
}, null, 2));
