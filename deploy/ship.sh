#!/usr/bin/env bash
# Runs on the Actions runner. The registry token travels over SSH stdin, never in argv.
set -euo pipefail
set +x
umask 077

: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_PORT:=22}"
: "${DEPLOY_HOST_KEY:?Set the trusted public SSH host key}"
: "${DEPLOY_SSH_KEY:?Set DEPLOY_SSH_KEY}"
: "${GH_TOKEN:?Missing registry token}"
: "${GH_ACTOR:?Missing GitHub actor}"
: "${RELEASE_SHA:?Missing commit SHA}"
: "${REPOSITORY:?Missing repository}"
[[ $DEPLOY_HOST =~ ^[a-zA-Z0-9.-]+$ && $DEPLOY_PORT =~ ^[0-9]+$ ]]
(( DEPLOY_PORT > 0 && DEPLOY_PORT <= 65535 ))
[[ $RELEASE_SHA =~ ^[0-9a-f]{40}$ && $GH_ACTOR =~ ^[a-zA-Z0-9_-]+$ ]]
prefix="ghcr.io/${REPOSITORY,,}"
[[ $prefix =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+$ ]]
[[ $DEPLOY_HOST_KEY =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+$ ]]

temp=$(mktemp -d)
trap 'rm -rf -- "$temp"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$temp/key"
printf '[%s]:%s %s\n' "$DEPLOY_HOST" "$DEPLOY_PORT" "$DEPLOY_HOST_KEY" > "$temp/known_hosts"
# OpenSSH stores default port 22 without brackets.
if [[ $DEPLOY_PORT == 22 ]]; then
  printf '%s %s\n' "$DEPLOY_HOST" "$DEPLOY_HOST_KEY" > "$temp/known_hosts"
fi
cat > "$temp/config" <<EOF
Host linker-deploy
    HostName $DEPLOY_HOST
    Port $DEPLOY_PORT
    User linker
    IdentityFile $temp/key
    IdentitiesOnly yes
    UserKnownHostsFile $temp/known_hosts
    StrictHostKeyChecking yes
    BatchMode yes
    ConnectTimeout 15
    ServerAliveInterval 15
    ServerAliveCountMax 3
EOF

release="/home/linker/Linker/releases/$RELEASE_SHA"
tar -czf "$temp/release.tar.gz" compose.yml compose.prod.yml compose.images.yml nginx/production.conf deploy/apply.sh
ssh -F "$temp/config" linker-deploy "mkdir -p '$release'"
scp -F "$temp/config" "$temp/release.tar.gz" "linker-deploy:$release/release.tar.gz"
ssh -F "$temp/config" linker-deploy "cd '$release' && tar -xzf release.tar.gz"
printf '%s\n' "$GH_TOKEN" | ssh -F "$temp/config" linker-deploy \
  "bash '$release/deploy/apply.sh' '$RELEASE_SHA' '$prefix' '$GH_ACTOR'"
