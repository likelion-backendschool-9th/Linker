#!/usr/bin/env node
/**
 * Seed + verify page-23 post detail APIs against local Docker DB / bootRun.
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
 ('dev', 'Dev', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}'),
 ('viewer', 'Viewer', 'DEVELOPER', 'ACTIVE', false, 'OFF', true, '${now}', '${now}')
ON CONFLICT (username) DO UPDATE SET updated_at = EXCLUDED.updated_at
`);
const authorId = psql(`SELECT id FROM users WHERE username = 'dev'`);
const viewerId = psql(`SELECT id FROM users WHERE username = 'viewer'`);

psql(`
INSERT INTO github_repos (
  github_repo_id, owner_login, name, full_name, description, primary_language,
  stargazers_count, forks_count, html_url, is_private, is_fork, parent_full_name,
  default_branch, metadata_synced_at, deleted_at, created_at, updated_at
) VALUES
 (2001, 'dev', 'linker-web', 'dev/linker-web', 'owned public', 'TypeScript', 3, 1, 'https://github.com/dev/linker-web', false, false, null, 'main', '${now}', null, '${now}', '${now}')
ON CONFLICT (full_name) DO UPDATE SET
  owner_login = EXCLUDED.owner_login,
  is_private = EXCLUDED.is_private,
  updated_at = EXCLUDED.updated_at
`);
const repoId = psql(`SELECT id FROM github_repos WHERE full_name = 'dev/linker-web'`);

psql(`
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
  ${authorId}, ${repoId}, '상세 검증용 소개', '상세 본문', 'Backend', 0, 0,
  0, 0, 0, 'VISIBLE', '${now}', '${now}'
)
`);
const postId = psql(`SELECT id FROM posts WHERE author_id = ${authorId} ORDER BY id DESC LIMIT 1`);

function issueSession(userId) {
	const token = signJwt(env.JWT_PRIVATE_KEY, { subject: String(userId), memberType: 'DEVELOPER' }, expiresAt);
	const hash = sha256Hex(token);
	psql(`DELETE FROM user_sessions WHERE user_id = ${userId}`);
	psql(`
INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip, expires_at, created_at, updated_at)
VALUES (${userId}, '${hash}', 'local-verify-23', '127.0.0.1', '${expiresAt.toISOString()}', '${now}', '${now}')
`);
	return { cookie: token };
}

const guest = await http('GET', `/api/v1/public/posts/${postId}`, null);
assert(guest.status === 200, `guest detail ${guest.status}`);
assert(guest.json.intro === '상세 검증용 소개', 'intro');
assert(guest.json.likedByMe === false, 'guest likedByMe');

const missing = await http('GET', '/api/v1/public/posts/999999', null);
assert(missing.status === 404, `missing ${missing.status}`);

const viewer = issueSession(viewerId);
const viewed = await http('GET', `/api/v1/public/posts/${postId}?from=share`, viewer);
assert(viewed.status === 200, `viewer detail ${viewed.status}`);
assert(viewed.json.trafficSource === 'EXTERNAL_LINK', 'traffic');
assert(viewed.json.viewCount === 1, `viewCount=${viewed.json.viewCount}`);
const viewRows = psql(`SELECT source FROM post_views WHERE post_id = ${postId} AND viewer_id = ${viewerId}`);
assert(viewRows === 'EXTERNAL', `post_views source=${viewRows}`);

const like = await http('POST', `/api/v1/user/posts/${postId}/likes`, viewer);
assert(like.status === 200 && like.json.likeCount === 1, `like ${like.status}`);
const likeAgain = await http('POST', `/api/v1/user/posts/${postId}/likes`, viewer);
assert(likeAgain.json.likeCount === 1, 'like idempotent');

const comment = await http('POST', `/api/v1/user/posts/${postId}/comments`, viewer, {
	body: { text: '좋은 글이에요', parentId: null },
});
assert(comment.status === 201, `comment ${comment.status} ${JSON.stringify(comment.json)}`);
const comments = await http('GET', `/api/v1/public/posts/${postId}/comments`, null);
assert(comments.status === 200 && comments.json.items.length === 1, 'comments list');

const author = issueSession(authorId);
const del = await http('DELETE', `/api/v1/user/posts/${postId}`, author);
assert(del.status === 204, `delete ${del.status}`);
const afterDelete = await http('GET', `/api/v1/public/posts/${postId}`, null);
assert(afterDelete.status === 404, 'deleted detail 404');

const flyway = psql(`SELECT version FROM flyway_schema_history WHERE version = '4' AND success`);
assert(flyway === '4', `flyway v4=${flyway}`);

console.log(JSON.stringify({
	ok: true,
	postId: Number(postId),
	checks: [
		'guest detail',
		'from=share EXTERNAL view',
		'like idempotent',
		'comment create/list',
		'soft-delete 404',
		'Flyway V4',
	],
}, null, 2));
