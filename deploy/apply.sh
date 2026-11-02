#!/usr/bin/env bash
# Runs as linker on the server. Never edits .env, certificates or the host Nginx.
set -euo pipefail
set +x
umask 077

sha=${1:?Commit SHA required}
prefix=${2:?Image prefix required}
actor=${3:?Registry username required}
[[ $sha =~ ^[0-9a-f]{40}$ && $prefix =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+$ ]]
[[ $actor =~ ^[a-zA-Z0-9_-]+$ ]]
root=/home/linker/Linker
release="$root/releases/$sha"
[[ -f $root/.env && -f $release/compose.images.yml ]]
mkdir -p "$root/.deployment-state"
exec 9> "$root/.deployment-state/lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
sudo -n docker info > /dev/null

auth=$(mktemp -d)
trap 'rm -rf -- "$auth"' EXIT
IFS= read -r token
printf '%s\n' "$token" | sudo -n docker --config "$auth" login ghcr.io -u "$actor" --password-stdin > /dev/null
unset token
docker=(sudo -n docker --config "$auth")
compose=("${docker[@]}" compose --env-file "$root/.env" --env-file "$release/.release.env" -p linker -f "$release/compose.yml" -f "$release/compose.prod.yml" -f "$release/compose.images.yml")
printf 'IMAGE_PREFIX=%s\nIMAGE_TAG=%s\n' "$prefix" "$sha" > "$release/.release.env"
"${compose[@]}" config --quiet

# Capture running application images before pulling/replacing anything.
# DB/Redis are left running; their data and migrations are never rolled back here.
previous=$root
if [[ -f $root/.deployment-state/active ]]; then
  previous=$(cat "$root/.deployment-state/active")
  [[ $previous == "$root/releases/"* && -f $previous/compose.prod.yml ]]
fi
backup=$(mktemp -d "$release/previous.XXXXXXXX")
mkdir -p "$backup/nginx"
cp "$previous/compose.yml" "$previous/compose.prod.yml" "$backup/"
cp "$previous/nginx/production.conf" "$backup/nginx/production.conf"
printf 'services:\n' > "$backup/rollback.yml"
for service in backend web proxy; do
  ids=$("${docker[@]}" ps -q --filter label=com.docker.compose.project=linker --filter "label=com.docker.compose.service=$service")
  [[ -n $ids && $ids != *$'\n'* ]] || { echo "Expected one running $service container." >&2; exit 1; }
  image=$("${docker[@]}" inspect --format '{{.Image}}' "$ids")
  tag="linker-rollback/$service:$sha"
  "${docker[@]}" tag "$image" "$tag"
  printf '  %s:\n    build: !reset null\n    image: %s\n' "$service" "$tag" >> "$backup/rollback.yml"
done
rollback=("${docker[@]}" compose --env-file "$root/.env" -p linker -f "$backup/compose.yml" -f "$backup/compose.prod.yml" -f "$backup/rollback.yml")
"${rollback[@]}" config --quiet
"${compose[@]}" pull backend web proxy

probe() {
  curl --fail --silent --show-error --retry 3 --retry-delay 2 --max-time 10 \
    -H 'Host: linker.newlecture.com' -H 'X-Forwarded-Proto: https' \
    http://127.0.0.1:3004/ --output /dev/null
}
if "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 300 backend web proxy && probe; then
  printf '%s\n' "$release" > "$root/.deployment-state/active.next"
  mv "$root/.deployment-state/active.next" "$root/.deployment-state/active"
  echo "Deployed $sha"
else
  echo 'Deployment failed; restoring previous application images/configuration.' >&2
  if "${rollback[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 300 backend web proxy && probe; then
    # Next deployment must snapshot the configuration actually in use after rollback.
    printf '%s\n' "$backup" > "$root/.deployment-state/active.next"
    mv "$root/.deployment-state/active.next" "$root/.deployment-state/active"
    echo 'Previous application restored.' >&2
  else
    echo 'Rollback failed. Inspect service status and logs manually.' >&2
  fi
  exit 1
fi
