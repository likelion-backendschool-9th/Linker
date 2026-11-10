# Ollama 실행과 C 연결 정보

B는 Docker 서버를 운영하고 C는 `LlmClient`·요약 API를 구현한다(WBS 17). **테스트·기능 시연용 모델은 `qwen3:4b`로 선정해 운영 서버에 설치했다.** 모델 교체는 별도 확인 후 진행한다. Docker health, 모델 추론, C의 업무 API 연결을 각각 구분해 확인한다.

## 호출 정보

| 호출 위치 | Base URL |
| --- | --- |
| 같은 Docker 네트워크의 백엔드 (운영은 `linker_default`) | `http://ollama:11434` |
| Ollama를 실행한 호스트의 로컬 백엔드 | `http://127.0.0.1:11434` |
| 개발자 PC → 운영 Ollama | 아래 SSH 터널을 연 뒤 `http://127.0.0.1:11435` |

- 버전: `GET /api/version`
- 설치된 모델의 정확한 이름: `GET /api/tags` 응답의 `models[].name`
- 요약 호출: `POST /api/chat`의 `model`, `messages`, `stream: false`, `think: false`, `format`(JSON 스키마). 결과 텍스트는 `message.content`에 있다. 실제 메시지 필터링·결과 검증·타임아웃/비동기 처리는 C가 구현한다.
- 백엔드 환경변수: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`. 루트 Compose는 이를 백엔드에만 전달한다. 모델 기본값은 시연용 `qwen3:4b`이며 `OLLAMA_MODEL`로 명시적으로 변경할 수 있다. 모델 자동 다운로드·대체 동작은 없다. Spring 설정 바인딩은 C가 자신의 어댑터에 연결한다.
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

기본 자원 상한은 CPU 2개·RAM 4GiB(추가 swap 사용 없음), 모델 동시 로드/추론은 각각 1개, 서버 대기열은 16개다. 이는 운영 자원 설정이며 요약 API의 개인별 일일 한도와 별개다. 메모리는 모델과 컨텍스트에 따라 달라진다. 이번 스모크 검증은 2048 토큰 컨텍스트·CPU 스레드 2개를 사용한다. 실제 500개 메시지를 이 설정으로 모두 처리할 수 있다고 보지 않는다.

포트·자원·이미지를 바꾸려면 `deploy/ollama/.env.example`의 항목만 개인 환경 파일에 복사한 뒤 `--env-file`에 지정한다. 기존 루트 `.env`를 덮어쓰지 않는다.

## 운영 서버: 기존 앱과 별도로 실행

서버의 `/home/linker/Linker`에서 아래 파일를 `ollama-runtime/`에 복사해 사용한다. 앱 `releases/{SHA}`와 별개인 Compose 프로젝트 `linker-ollama`다. 기존 자동 배포·DB·Redis·앱 컨테이너는 교체하지 않는다.

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

기존 서버 백엔드에는 새 환경변수가 아직 적용되지 않을 수 있다. 루트 Compose 변경이 정상 배포되고 C 어댑터가 환경변수를 바인딩한 뒤 사용한다. 시연용 기본 모델은 `qwen3:4b`이고 다른 모델은 환경변수로 지정한다. 이 준비를 위해 운영 백엔드를 임의로 재시작하지 않는다.

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

C가 로컬 Spring을 실행할 때 `OLLAMA_BASE_URL=http://127.0.0.1:11435`, `OLLAMA_MODEL=qwen3:4b`를 전달한다. 원격 테스트에 실제 개인 채팅을 사용하지 않고 합성 문장으로 먼저 검증한다.

## 시연용 모델과 재현 검증

운영 모델은 이미 설치되어 있다. 개인 PC에 따로 설치하려는 경우 다음 명령을 사용한다.

```bash
docker compose --env-file /dev/null -f deploy/ollama/compose.yml exec ollama ollama pull qwen3:4b
curl --fail http://127.0.0.1:11434/api/tags
```

SSH 터널을 연 PC에서 실제 개인 채팅 대신 합성 한국어 대화 20개로 검증한다.

```bash
python3 deploy/ollama/smoke.py --base-url http://127.0.0.1:11435 --model qwen3:4b --runs 2
```

직접 실행한 로컬 Ollama라면 `--base-url http://127.0.0.1:11434`로 바꾼다. CPU 추론의 최초 로딩·반복 호출 시간, 입력/출력 토큰 수, 완료 이유, 한국어 JSON 결과가 출력된다. 모델을 다른 요청이 이미 로드했다면 첫 번째 호출도 warm 상태일 수 있다.

호출 설정은 `think: false`, `stream: false`, JSON 스키마, 컨텍스트 2048, 출력 최대 384 토큰, 스레드 2개다. 출력 토큰 제한 때문에 잘렸거나 JSON 필드 타입이 다르면 검증은 실패한다. 180초는 이 스모크 도구의 HTTP 대기 상한이며 C 업무 API의 동기/비동기 계약을 정하는 값이 아니다.

`format: "json"`만으로는 DTO 필드 타입까지 보장되지 않는다. 처음 plain JSON 호출에서는 `action_items`가 검증에서 기대한 타입과 달랐다. C는 실제 응답 DTO에 맞는 JSON 스키마와 서버 검증을 함께 사용해야 한다. 이 스모크의 `summary`, `decisions`, `action_items`, `open_questions`는 **검증용 예시**이며 C의 최종 API/DTO 계약을 새로 정하는 것이 아니다.

실제 서비스의 메시지 필터·최대 500개 입력·컨텍스트 예산·30초 초과 비동기 처리·시연 화면 연결은 C가 확인한다. 이 파일의 예제만으로 해당 업무 API 전체를 검증했다고 보지 않는다.

## 종료

```bash
docker compose --env-file /dev/null -f deploy/ollama/compose.yml stop
```

운영에서는 같은 `compose.server.yml`과 네트워크 환경변수를 포함한다. 모델은 named volume에 보존된다. `down -v`는 사용하지 않는다.

공식 근거: [Docker 실행](https://docs.ollama.com/docker), [로컬 전용 모드·동시성](https://docs.ollama.com/faq), [Chat API](https://docs.ollama.com/api/chat).

## 확인 상태 (2026-11-09)

- 운영 `linker-ollama-ollama-1`: Ollama `0.40.15`, healthy, `/api/version` 200.
- 기존 운영 백엔드 컨테이너에서 `http://ollama:11434/api/version` 200 및 `POST /api/chat`의 실제 `qwen3:4b` JSON 생성 200 확인.
- 개발자 PC → SSH `127.0.0.1:11435` 경유 `/api/version`·`/api/tags` 확인.
- `/api/tags`의 설치 모델: `qwen3:4b`, Q4_K_M, 2,497,293,931 bytes, digest `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`.
- 운영 CPU 6코어, RAM 약 31GiB 중 확인 시 약 24GiB 가용, NVIDIA 런타임 없음. CPU 추론을 사용하며 GPU 가속을 전제로 하지 않는다.
- 20개 합성 한국어 대화(533 입력 토큰·177 출력 토큰) JSON 스키마 검증 2회 통과: 최초 61.50초(모델 로드 4.08초 포함), 반복 31.63초(로드 0초), 완료 사유 `stop`.
- CPU 2개·4GiB 상한에서 관찰된 메모리 약 2.9GiB, 컨텍스트 2048, OOM/컨테이너 재시작 없음. 숫자는 이 합성 입력의 측정값이며 실제 채팅·최대 500개 입력의 성능 보장이 아니다.
- 30초 초과가 관찰되었으므로 C의 기존 202·비동기 진행/완료 계약을 연결해야 한다. 스모크 도구의 180초 타임아웃을 업무 API 계약으로 복사하지 않는다.
- JSON 필드 타입을 통과해도 내용 검토는 필요하다. 이 예제에서는 '기기 확보 여부 확인'이 '기기 확보'로 축약되는 의미 차이가 관찰되었다. 기존 정책의 사용자 검토·저장 단계를 유지한다.
- 기존 앱·DB·Redis 컨테이너 재시작 없이 준비했고 서비스 HTTPS 200을 확인했다.
