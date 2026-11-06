#!/usr/bin/env node
/**
 * Seed + verify page-24 home feed APIs against local Docker DB / bootRun.
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

psql(`
INSERT INTO users (username, display_name, user_type, status, looking_for_team, job_seeking_status, push_enabled, created_at, updated_at)
VALUES
 ('feed_author', 'Feed Author', 'DEVELOPER', 'ACTIVE', false, 'OPEN', true, '${now}', '${now}'),
 ('feed_viewer', 'Feed Viewer', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}')
ON CONFLICT (username) DO UPDATE SET
  job_seeking_status = EXCLUDED.job_seeking_status,
  updated_at = EXCLUDED.updated_at
`);
const authorId = psql(`SELECT id FROM users WHERE username = 'feed_author'`);
const viewerId = psql(`SELECT id FROM users WHERE username = 'feed_viewer'`);

psql(`
INSERT INTO github_repos (
  github_repo_id, owner_login, name, full_name, description, primary_language,
  stargazers_count, forks_count, html_url, is_private, is_fork, parent_full_name,
  default_branch, metadata_synced_at, deleted_at, created_at, updated_at
) VALUES
 (2401, 'feed_author', 'feed-demo', 'feed_author/feed-demo', 'feed public', 'TypeScript', 1, 0, 'https://github.com/feed_author/feed-demo', false, false, null, 'main', '${now}', null, '${now}', '${now}')
ON CONFLICT (full_name) DO UPDATE SET updated_at = EXCLUDED.updated_at
`);
const repoId = psql(`SELECT id FROM github_repos WHERE full_name = 'feed_author/feed-demo'`);

psql(`
DELETE FROM feed_seen_posts WHERE user_id IN (${authorId}, ${viewerId});
DELETE FROM post_views WHERE post_id IN (SELECT id FROM posts WHERE author_id IN (${authorId}, ${viewerId}));
DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE author_id IN (${authorId}, ${viewerId}));
DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE author_id IN (${authorId}, ${viewerId}));
DELETE FROM post_tags WHERE post_id IN (SELECT id FROM posts WHERE author_id IN (${authorId}, ${viewerId}));
DELETE FROM post_demo_links WHERE post_id IN (SELECT id FROM posts WHERE author_id IN (${authorId}, ${viewerId}));
DELETE FROM post_images WHERE post_id IN (SELECT id FROM posts WHERE author_id IN (${authorId}, ${viewerId}));
DELETE FROM posts WHERE author_id IN (${authorId}, ${viewerId});
`);

psql(`
INSERT INTO posts (
  author_id, repo_id, summary, body, my_role, my_commit_count, linker_issue_count,
  like_count, comment_count, view_count, visibility, created_at, updated_at
) VALUES (
  ${authorId}, ${repoId}, '피드 검증용 소개', '피드 본문', 'Backend', 0, 0,
  2, 0, 0, 'VISIBLE', '${now}', '${now}'
)
`);
const postId = psql(`SELECT id FROM posts WHERE author_id = ${authorId} ORDER BY id DESC LIMIT 1`);

psql(`
INSERT INTO post_likes (post_id, user_id, created_at, updated_at)
VALUES (${postId}, ${viewerId}, '${now}', '${now}')
ON CONFLICT DO NOTHING
`);

function issueSession(userId) {
	const token = signJwt(env.JWT_PRIVATE_KEY, { subject: String(userId), memberType: 'DEVELOPER' }, expiresAt);
	const hash = sha256Hex(token);
	psql(`DELETE FROM user_sessions WHERE user_id = ${userId}`);
	psql(`
INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip, expires_at, created_at, updated_at)
VALUES (${userId}, '${hash}', 'local-verify-24', '127.0.0.1', '${expiresAt.toISOString()}', '${now}', '${now}')
`);
	return { cookie: token };
}

const guest = await http('GET', '/api/v1/public/feed', null);
assert(guest.status === 200, `guest feed ${guest.status}`);
assert(Array.isArray(guest.json.items), 'guest items');
assert(guest.json.items.some((item) => item.type === 'POST' && item.post.id === Number(postId)), 'guest sees seeded post');
assert(
	guest.json.items.every((item) => item.whyShown === '이번 주 인기' || item.whyShown === '새로 올라온 작업물'),
	'guest whyShown'
);

const offers = await http('GET', '/api/v1/public/feed?offersOnly=true', null);
assert(offers.status === 200, `offersOnly ${offers.status}`);
assert(offers.json.items.some((item) => item.post.id === Number(postId)), 'OPEN author in offersOnly');

const viewer = issueSession(viewerId);
const authed = await http('GET', '/api/v1/public/feed', viewer);
assert(authed.status === 200, `authed feed ${authed.status}`);
assert(authed.json.items.some((item) => item.post.id === Number(postId)), 'viewer sees others post');

const seen = await http('POST', '/api/v1/user/feed/seen', viewer, { body: { postIds: [Number(postId)] } });
assert(seen.status === 204, `seen ${seen.status}`);
const seenAgain = await http('POST', '/api/v1/user/feed/seen', viewer, { body: { postIds: [Number(postId)] } });
assert(seenAgain.status === 204, `seen idempotent ${seenAgain.status}`);
const seenRows = psql(`SELECT count(*) FROM feed_seen_posts WHERE user_id = ${viewerId} AND post_id = ${postId}`);
assert(seenRows === '1', `feed_seen_posts count=${seenRows}`);

const afterSeen = await http('GET', '/api/v1/public/feed', viewer);
assert(afterSeen.status === 200, `feed after seen ${afterSeen.status}`);
assert(!afterSeen.json.items.some((item) => item.post.id === Number(postId)), 'seen post excluded from recommendations');

const recommended = await http('GET', '/api/v1/user/feed/recommended-users', viewer);
assert(recommended.status === 200, `recommended ${recommended.status}`);
assert(Array.isArray(recommended.json.items) && recommended.json.items.length === 0, 'recommended empty without tech tags');

const flyway = psql(`SELECT version FROM flyway_schema_history WHERE version = '5' AND success`);
assert(flyway === '5', `flyway v5=${flyway}`);

console.log(JSON.stringify({
	ok: true,
	postId: Number(postId),
	checks: [
		'guest feed whyShown',
		'offersOnly OPEN',
		'seen upsert + recommend exclude',
		'recommended-users empty fallback',
		'Flyway V5',
	],
}, null, 2));
