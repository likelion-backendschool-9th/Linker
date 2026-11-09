# Ollama 실행과 C 연결 정보

B는 Docker 서버를 운영하고 C는 `LlmClient`·요약 API를 구현한다(WBS 17). **모델은 팀 합의 전까지 선택하거나 자동 다운로드하지 않는다.** Docker health가 정상이라는 사실과 모델로 요약이 가능하다는 사실을 구분한다.

## 호출 정보

| 호출 위치 | Base URL |
| --- | --- |
| 같은 Docker 네트워크의 백엔드 (운영은 `linker_default`) | `http://ollama:11434` |
| Ollama를 실행한 호스트의 로컬 백엔드 | `http://127.0.0.1:11434` |
| 개발자 PC → 운영 Ollama | 아래 SSH 터널을 연 뒤 `http://127.0.0.1:11435` |

- 버전: `GET /api/version`
- 설치된 모델의 정확한 이름: `GET /api/tags` 응답의 `models[].name`
- 요약 호출: `POST /api/chat`의 `model`, `messages`, `stream: false`, `format: "json"`. 결과 텍스트는 `message.content`에 있다. 실제 메시지 필터링·결과 검증·타임아웃/비동기 처리는 C가 구현한다.
- 백엔드 환경변수: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`. 루트 Compose는 이를 백엔드에만 전달한다. 모델 기본값은 비워 두었고 자동 대체 모델은 없다. Spring 설정 바인딩은 C가 자신의 어댑터에 연결한다.
- 공개 도메인/Nginx에는 Ollama를 연결하지 않는다. 11434는 호스트 loopback에만 공개하고 `OLLAMA_NO_CLOUD=1`로 클라우드 기능을 비활성화한다.

## 개인 PC: 모델 없는 서버부터 실행

저장소 루트에서 실행한다. 루트 `.env`의 DB/JWT 값이 필요하지 않다. Docker Desktop/Engine이 먼저 실행 중이어야 한다.

```bash
docker compose --env-file /dev/null -f deploy/ollama/compose.yml config --quiet
docker compose --env-file /dev/null -f deploy/ollama/compose.yml up -d --wait
curl --fail http://127.0.0.1:11434/api/version
curl --fail http://127.0.0.1:11434/api/tags
```

위 실행은 **PC에서 직접 실행하는 Spring**에 맞는 구성이다. 백엔드도 Docker에서 실행한다면, 그 백엔드의 네트워크를 먼저 확인하고 다음과 같이 기존 네트워크에 연결한다. 네트워크가 존재해야 하며 모델 볼륨은 그대로 유지된다.

```bash
OLLAMA_DOCKER_NETWORK=linker_default docker compose --env-file /dev/null \
  -f deploy/ollama/compose.yml -f deploy/ollama/compose.server.yml up -d --wait
```

기본 자원 상한은 CPU 2개·RAM 4GiB(추가 swap 사용 없음), 모델 동시 로드/추론은 각각 1개, 서버 대기열은 16개다. 이는 운영 자원 설정이며 요약 API의 개인별 일일 한도와 별개다. 4GiB는 모델 실행에 충분하다는 보장이 아니다. 모델·컨텍스트를 합의한 뒤 실측해 조정한다.

포트·자원·이미지를 바꾸려면 `deploy/ollama/.env.example`의 항목만 개인 환경 파일에 복사한 뒤 `--env-file`에 지정한다. 기존 루트 `.env`를 덮어쓰지 않는다.

## 운영 서버: 기존 앱과 별도로 실행

서버의 `/home/linker/Linker`에서 아래 파일 두 개를 `ollama-runtime/`에 복사해 사용한다. 앱 `releases/{SHA}`와 별개인 Compose 프로젝트 `linker-ollama`다. 기존 자동 배포·DB·Redis·앱 컨테이너는 교체하지 않는다.

1. `deploy/ollama/compose.yml` → `ollama-runtime/compose.yml`
2. `deploy/ollama/compose.server.yml` → `ollama-runtime/compose.server.yml`
3. 없을 때만 `deploy/ollama/.env.example` → `ollama-runtime/.env` (기존 설정을 덮어쓰지 않는다)

```bash
# 먼저 실제 backend 네트워크를 확인한다. 환경변수/비밀값은 출력하지 않는다.
sudo -n docker inspect linker-backend-1 --format '{{json .NetworkSettings.Networks}}'

sudo -n docker compose --env-file ollama-runtime/.env \
  -f ollama-runtime/compose.yml -f ollama-runtime/compose.server.yml config --quiet

sudo -n docker compose --env-file ollama-runtime/.env \
  -f ollama-runtime/compose.yml -f ollama-runtime/compose.server.yml up -d --wait
```

`linker_default`는 현재 운영 백엔드의 네트워크다. 다른 환경에서는 `ollama-runtime/.env`의 `OLLAMA_DOCKER_NETWORK`를 확인한 값으로 지정한다. 외부 네트워크가 없으면 실행이 실패하도록 했으며 앱 네트워크를 새로 만들거나 대체하지 않는다.

기존 서버 백엔드에는 새 환경변수가 아직 적용되지 않을 수 있다. 루트 Compose 변경이 정상 배포되고 모델명이 서버 환경에 설정된 뒤 C 어댑터에서 사용한다. 이 준비를 위해 운영 백엔드를 임의로 재시작하지 않는다.

## 팀원 PC에서 서버 연결

SSH 권한이 있는 본인 계정/키를 사용한다. 접속 자격증명을 저장소에 넣거나 공유용 명령에 붙이지 않는다.

```bash
ssh -N -L 127.0.0.1:11435:127.0.0.1:11434 linker@cloud.newlecture.com
```

다른 터미널에서 확인한다.

```bash
curl --fail http://127.0.0.1:11435/api/version
curl --fail http://127.0.0.1:11435/api/tags
```

C가 로컬 Spring을 실행할 때 `OLLAMA_BASE_URL=http://127.0.0.1:11435`와 합의한 `OLLAMA_MODEL`을 전달한다. 원격 테스트에 실제 개인 채팅을 사용하지 않고 합성 문장으로 먼저 검증한다.

## 모델 합의 후

운영 모델 pull은 B가 수행한다. 로컬 예시는 다음과 같다. `AGREED_MODEL`은 팀에서 정한 정확한 태그로 직접 설정한다.

```bash
: "${AGREED_MODEL:?팀에서 합의한 모델 태그를 설정하세요}"
docker compose --env-file /dev/null -f deploy/ollama/compose.yml exec ollama ollama pull "$AGREED_MODEL"
curl --fail http://127.0.0.1:11434/api/tags
```

정확한 태그를 확인한 다음 백엔드의 `OLLAMA_MODEL`에 같은 값을 설정한다. CPU 서버의 처리 시간·메모리·한국어 요약·JSON 형식·500개 메시지 경계는 별도로 측정한다. 현재는 이 검증을 완료했다고 보지 않는다.

## 종료

```bash
docker compose --env-file /dev/null -f deploy/ollama/compose.yml stop
```

운영에서는 같은 `compose.server.yml`과 네트워크 환경변수를 포함한다. 모델은 named volume에 보존된다. `down -v`는 사용하지 않는다.

공식 근거: [Docker 실행](https://docs.ollama.com/docker), [로컬 전용 모드·동시성](https://docs.ollama.com/faq), [Chat API](https://docs.ollama.com/api/chat).

## 확인 상태 (2026-11-09)

- 운영 `linker-ollama-ollama-1`: Ollama `0.40.15`, healthy, `/api/version` 200.
- 기존 운영 백엔드 컨테이너에서 `http://ollama:11434/api/version` 200 확인.
- 개발자 PC → SSH `127.0.0.1:11435` 경유 `/api/version`·`/api/tags` 확인.
- `/api/tags`는 `models: []`. 합의 전 모델을 설치하지 않았으므로 실제 요약 추론은 미검증이다.
- 운영 CPU 6코어, RAM 약 31GiB 중 확인 시 약 24GiB 가용, NVIDIA 런타임 없음. CPU 추론의 모델 후보는 선정 후 한국어·JSON·지연 시간을 실측해야 한다.
- 기존 앱·DB·Redis 컨테이너 재시작 없이 준비했고 서비스 HTTPS 200을 확인했다.
