#!/usr/bin/env node
/**
 * Seed + verify page-21 recruit detail / apply / review against local Docker + bootRun.
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
const deadline = new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString().slice(0, 10);

psql(`
INSERT INTO users (username, display_name, user_type, status, looking_for_team, job_seeking_status, push_enabled, created_at, updated_at)
VALUES
 ('r21_author', 'R21 Author', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}'),
 ('r21_applicant', 'R21 Applicant', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}'),
 ('r21_applicant2', 'R21 Applicant2', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}')
ON CONFLICT (username) DO UPDATE SET updated_at = EXCLUDED.updated_at
`);
const authorId = psql(`SELECT id FROM users WHERE username = 'r21_author'`);
const applicantId = psql(`SELECT id FROM users WHERE username = 'r21_applicant'`);
const applicant2Id = psql(`SELECT id FROM users WHERE username = 'r21_applicant2'`);

psql(`
DELETE FROM applications WHERE recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id = ${authorId})
  OR applicant_id IN (${applicantId}, ${applicant2Id});
DELETE FROM recruit_post_tags WHERE recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id = ${authorId});
DELETE FROM recruit_roles WHERE recruit_post_id IN (SELECT id FROM recruit_posts WHERE author_id = ${authorId});
DELETE FROM recruit_posts WHERE author_id = ${authorId};
`);

function issueSession(userId) {
	const token = signJwt(env.JWT_PRIVATE_KEY, { subject: String(userId), memberType: 'DEVELOPER' }, expiresAt);
	const hash = sha256Hex(token);
	psql(`DELETE FROM user_sessions WHERE user_id = ${userId}`);
	psql(`
INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip, expires_at, created_at, updated_at)
VALUES (${userId}, '${hash}', 'local-verify-21', '127.0.0.1', '${expiresAt.toISOString()}', '${now}', '${now}')
`);
	return { cookie: token };
}

const author = issueSession(authorId);
const applicant = issueSession(applicantId);
const applicant2 = issueSession(applicant2Id);

const create = await http('POST', '/api/v1/user/recruits', author, {
	body: {
		title: 'R21 상세 검증 모집',
		intro: '지원·검토 로컬 검증용 소개입니다.',
		roles: [
			{ id: null, role: 'BACKEND', headcount: 1 },
			{ id: null, role: 'FRONTEND', headcount: 1 },
		],
		format: 'ONLINE',
		region: null,
		goal: 'LEARNING',
		duration: '1개월',
		deadline,
		techTags: ['Java'],
		teamId: null,
	},
});
assert(create.status === 201, `create ${create.status} ${JSON.stringify(create.json)}`);
const recruitId = create.json.id;

const form = await http('GET', `/api/v1/user/recruits/${recruitId}/edit-form`, author);
const backendRole = form.json.roles.find((r) => r.role === 'BACKEND');
const frontendRole = form.json.roles.find((r) => r.role === 'FRONTEND');
assert(backendRole && frontendRole, 'roles present');

const guestDetail = await http('GET', `/api/v1/public/recruits/${recruitId}`, null);
assert(guestDetail.status === 200, `guest detail ${guestDetail.status}`);
assert(guestDetail.json.title === 'R21 상세 검증 모집', 'detail title');
assert(guestDetail.json.myApplication == null, 'guest myApplication null');

const apply = await http('POST', `/api/v1/user/recruits/${recruitId}/applications`, applicant, {
	body: { roleId: backendRole.id, message: '백엔드로 지원합니다' },
});
assert(apply.status === 201, `apply ${apply.status} ${JSON.stringify(apply.json)}`);
const applicationId = apply.json.id ?? apply.json.applicationId;
assert(applicationId, `application id missing ${JSON.stringify(apply.json)}`);

const applicantDetail = await http('GET', `/api/v1/public/recruits/${recruitId}`, applicant);
assert(applicantDetail.status === 200, `applicant detail ${applicantDetail.status}`);
assert(applicantDetail.json.myApplication, 'myApplication present');
assert(applicantDetail.json.myApplication.status === 'PENDING', 'myApplication PENDING');

const authorDetail = await http('GET', `/api/v1/public/recruits/${recruitId}`, author);
assert(authorDetail.json.isAuthor === true, 'author flag');

const list = await http('GET', `/api/v1/user/recruits/${recruitId}/applications`, author);
assert(list.status === 200, `applicants ${list.status}`);
assert(list.json.items.some((item) => item.id === Number(applicationId)), 'applicant listed');

const sheet = await http('GET', `/api/v1/user/recruits/${recruitId}/applications/${applicationId}`, author);
assert(sheet.status === 200, `sheet ${sheet.status}`);
assert(sheet.json.message === '백엔드로 지원합니다', 'sheet message');

const acceptNoTeam = await http(
	'POST',
	`/api/v1/user/recruits/${recruitId}/applications/${applicationId}/accept`,
	author,
	{ body: { increaseHeadcount: false } },
);
assert(
	acceptNoTeam.status === 409 && acceptNoTeam.json?.code === 'TEAM_REQUIRED',
	`accept without B/D team join expected TEAM_REQUIRED got ${acceptNoTeam.status} ${JSON.stringify(acceptNoTeam.json)}`,
);
const stillPending = psql(`SELECT status FROM applications WHERE id = ${applicationId}`);
assert(stillPending === 'PENDING', `accept stub must not flip status=${stillPending}`);

const reject = await http(
	'POST',
	`/api/v1/user/recruits/${recruitId}/applications/${applicationId}/reject`,
	author,
	{ body: { reason: '스택이 맞지 않아요' } },
);
assert(reject.status === 204 || reject.status === 200, `reject ${reject.status}`);
const rejected = psql(`SELECT status FROM applications WHERE id = ${applicationId}`);
assert(rejected === 'REJECTED', `rejected=${rejected}`);

const apply2 = await http('POST', `/api/v1/user/recruits/${recruitId}/applications`, applicant2, {
	body: { roleId: frontendRole.id, message: '프론트 지원' },
});
assert(apply2.status === 201, `apply2 ${apply2.status}`);
const application2Id = apply2.json.id ?? apply2.json.applicationId;

psql(`UPDATE recruit_roles SET accepted_count = headcount WHERE id = ${frontendRole.id}`);
const acceptFull = await http(
	'POST',
	`/api/v1/user/recruits/${recruitId}/applications/${application2Id}/accept`,
	author,
	{ body: { increaseHeadcount: false } },
);
assert(
	acceptFull.status === 409 && (acceptFull.json?.code === 'ROLE_FULL' || acceptFull.json?.code === 'TEAM_REQUIRED'),
	`full/accept guard ${acceptFull.status} ${JSON.stringify(acceptFull.json)}`,
);

const close = await http('POST', `/api/v1/user/recruits/${recruitId}/close`, author);
assert(close.status === 204 || close.status === 200, `close ${close.status}`);
const applyClosed = await http('POST', `/api/v1/user/recruits/${recruitId}/applications`, applicant, {
	body: { roleId: backendRole.id, message: '마감 후 지원' },
});
assert(
	applyClosed.status === 409 && applyClosed.json?.code === 'RECRUIT_CLOSED',
	`closed apply ${applyClosed.status} ${JSON.stringify(applyClosed.json)}`,
);

const expiresSample = psql(`SELECT expires_at IS NOT NULL FROM applications WHERE id = ${applicationId}`);
assert(expiresSample === 't', 'expires_at set on apply (14-day batch cleanup deferred)');

console.log(JSON.stringify({
	ok: true,
	recruitId,
	applicationId: Number(applicationId),
	checks: [
		'guest/author/applicant detail',
		'apply 201 + myApplication',
		'applicant list + sheet',
		'accept TEAM_REQUIRED stub (no status flip)',
		'reject → REJECTED',
		'ROLE_FULL or TEAM_REQUIRED when full',
		'RECRUIT_CLOSED after close',
		'expires_at present (batch deferred)',
	],
	gaps: [
		'accept real team join / chat / notification needs B/D tables',
		'14-day expire batch not run in this script',
	],
}, null, 2));
