#!/usr/bin/env bash
# Runs as linker on the server. Never edits .env, certificates or the host Nginx.
# Rolling replacement: each app service briefly runs old + new containers behind the Docker Nginx,
# whose resolver (valid=10s) round-robins between them; the old one is retired only after the new
# one is healthy, so requests keep flowing. The proxy is recreated only when its configuration changes.
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
# Longer than the Nginx resolver cache (valid=10s), so it has seen the new container before the old stops.
settle=${DEPLOY_SETTLE_SECONDS:-12}
# Longer than Spring's graceful shutdown phase (30s) so in-flight requests finish before SIGKILL.
grace=40
[[ $settle =~ ^[0-9]+$ ]]
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

containers() { # containers <service> [docker ps flags...]
  local service=$1
  shift
  "${docker[@]}" ps -q "$@" --filter label=com.docker.compose.project=linker --filter "label=com.docker.compose.service=$service"
}

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
  ids=$(containers "$service")
  [[ -n $ids && $ids != *$'\n'* ]] || {
    echo "Expected one running $service container. Remove leftovers from an interrupted deployment first." >&2
    exit 1
  }
  image=$("${docker[@]}" inspect --format '{{.Image}}' "$ids")
  tag="linker-rollback/$service:$sha"
  "${docker[@]}" tag "$image" "$tag"
  printf '  %s:\n    build: !reset null\n    image: %s\n' "$service" "$tag" >> "$backup/rollback.yml"
done
rollback=("${docker[@]}" compose --env-file "$root/.env" -p linker -f "$backup/compose.yml" -f "$backup/compose.prod.yml" -f "$backup/rollback.yml")
"${rollback[@]}" config --quiet
"${compose[@]}" pull backend web proxy

# The proxy owns the only host port, so it cannot overlap; touch it only when its definition changed.
# Release paths differ per deployment, so hash the proxy service with one shared project directory
# (dependencies' settings are excluded) and compare the mounted Nginx file by content.
proxy_definition() { # proxy_definition <directory>
  "${docker[@]}" compose --env-file "$root/.env" -p linker --project-directory "$root" \
    -f "$1/compose.yml" -f "$1/compose.prod.yml" config --hash proxy
  cat "$1/nginx/production.conf"
}
proxy_changed=false
if [[ $(proxy_definition "$backup") != "$(proxy_definition "$release")" ]]; then
  proxy_changed=true
fi

replace() { # replace <compose array name> <service>
  local -n run=$1
  local service=$2 old id
  old=$(containers "$service")
  [[ -n $old && $old != *$'\n'* ]] || { echo "Expected one running $service container." >&2; return 1; }
  if ! "${run[@]}" up -d --no-deps --no-build --pull never --no-recreate --scale "$service=2" \
      --wait --wait-timeout 300 "$service"; then
    # The old container never stopped serving; discard only the new one.
    for id in $(containers "$service" -a); do
      [[ $id == "$old" ]] || "${docker[@]}" rm -f "$id" > /dev/null
    done
    echo "New $service container did not become healthy; the running one was kept." >&2
    return 1
  fi
  sleep "$settle"
  "${docker[@]}" stop --time "$grace" "$old" > /dev/null
  "${docker[@]}" rm "$old" > /dev/null
}

probe() {
  curl --fail --silent --show-error --retry 3 --retry-delay 2 --max-time 10 \
    -H 'Host: linker.newlecture.com' -H 'X-Forwarded-Proto: https' \
    http://127.0.0.1:3004/ --output /dev/null
}

# Backend first: a new web may call new APIs, while the old web keeps working on the new backend.
replaced=()
ok=true
for service in backend web; do
  if replace compose "$service"; then replaced+=("$service"); else ok=false; break; fi
done
if $ok && $proxy_changed; then
  replaced+=(proxy)
  "${compose[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 120 proxy || ok=false
fi

if $ok && probe; then
  printf '%s\n' "$release" > "$root/.deployment-state/active.next"
  mv "$root/.deployment-state/active.next" "$root/.deployment-state/active"
  echo "Deployed $sha (proxy recreated: $proxy_changed)"
  exit 0
fi

if (( ${#replaced[@]} == 0 )); then
  echo 'Deployment failed before any service was replaced; the running application was kept.' >&2
  exit 1
fi
echo 'Deployment failed; restoring previous application images/configuration.' >&2
restored=true
for service in "${replaced[@]}"; do
  if [[ $service == proxy ]]; then
    "${rollback[@]}" up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 120 proxy || restored=false
  else
    replace rollback "$service" || restored=false
  fi
done
if $restored && probe; then
  # Next deployment must snapshot the configuration actually in use after rollback.
  printf '%s\n' "$backup" > "$root/.deployment-state/active.next"
  mv "$root/.deployment-state/active.next" "$root/.deployment-state/active"
  echo 'Previous application restored.' >&2
else
  echo 'Rollback failed. Inspect service status and logs manually.' >&2
fi
exit 1
