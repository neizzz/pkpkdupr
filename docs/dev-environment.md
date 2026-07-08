# PkpkDupr dev 환경 구조와 흐름

이 문서는 로컬 개발 환경에서 앱, DB, 모니터링, SQLite row browser가 어떻게 연결되는지 설명합니다.

## 실행 명령

### 앱 개발 서버

```bash
pnpm dev
```

`pnpm dev`는 테스트/개발용 실행 흐름입니다.

- `apps/web`: `http://localhost:8080`
- `apps/admin-web`: `http://localhost:3100`
- `apps/api`: `http://localhost:4000`
- `apps/db-server`: `http://localhost:5001`

루트 스크립트는 dev DB 경로와 mock seed를 함께 주입합니다.

```bash
ENABLE_DEV_MOCK_DATA=true
DB_FILE_PATH=file:$PWD/data/db/db.sqlite
```

### 모니터링 스택

```bash
pnpm dev:monitoring
```

dev 모니터링은 운영 compose를 그대로 바꾸지 않고 `docker-compose.dev.yml` override를 더해 실행합니다.

- Uptime Kuma 직접 접근: `http://localhost:3300/`
- Uptime Kuma 공식 dev 접근: `http://localhost:8080/uptime/`
- sqlite-web 직접 접근: `http://localhost:3301/db/`
- sqlite-web 공식 dev 접근: `http://localhost:8080/db/`

종료:

```bash
pnpm dev:monitoring:down
```

## 시스템 구조

```text
┌────────────────────────────┐
│ apps/web                   │
│ Vite dev server :8080      │
│ - /api     -> :4000        │
│ - /uptime  -> :3300        │
│ - /db      -> :3301        │
└─────────────┬──────────────┘
              │
              │ /api
              ▼
┌────────────────────────────┐
│ apps/api :4000             │
│ Auth / Admin orchestration │
│ DB_SERVER_URL=:5001        │
└─────────────┬──────────────┘
              │ internal HTTP
              ▼
┌────────────────────────────┐
│ apps/db-server :5001       │
│ Drizzle + libSQL           │
│ DB_FILE_PATH=data/db/...   │
│ dev mock seed optional     │
└─────────────┬──────────────┘
              │ SQLite file
              ▼
┌────────────────────────────┐
│ data/db/db.sqlite          │
└─────────────┬──────────────┘
              │ read-only mount
              ├───────────────┐
              ▼               ▼
┌───────────────────┐   ┌────────────────────────────┐
│ sqlite-web        │   │ Uptime Kuma               │
│ DB row browser    │   │ API / admin URL checks    │
└───────────────────┘   └────────────────────────────┘
```

## dev DB와 mock 데이터

dev DB 파일은 루트 기준 아래 파일로 고정합니다.

```text
data/db/db.sqlite
```

`ENABLE_DEV_MOCK_DATA=true`이면 `apps/db-server` 시작 시 `TestDataRepository`가 mock 데이터를 idempotent하게 추가합니다.

### Mock 계정

| username | password | status |
| --- | --- | --- |
| `dev_alice` | `dev1234` | `active` |
| `dev_bob` | `dev1234` | `active` |
| `dev_chris_inactive` | `dev1234` | `inactive` |

관리자 계정은 API 서버가 별도로 bootstrap합니다.

| username | password |
| --- | --- |
| `admin` | `admin123` |

### Mock match 데이터

| table | rows | 내용 |
| --- | ---: | --- |
| `matches` | 2 | 완료된 doubles 경기 1건, 예정된 singles 경기 1건 |
| `match_scores` | 2 | 완료된 doubles 경기의 game score 2건 |

### Mock seed 특징

- 같은 username이 이미 있으면 다시 만들지 않습니다.
- 생성 로그와 상태 변경 로그는 deterministic id를 사용해 중복 삽입하지 않습니다.
- match와 match score도 deterministic id를 사용해 중복 삽입하지 않습니다.
- 운영 compose 기본 실행에는 mock seed가 켜지지 않습니다.

## dev 모니터링 / DB 확인

### Uptime Kuma

- 직접 접근: `http://localhost:3300/`
- 공식 dev 접근: `http://localhost:8080/uptime/`
- 첫 실행 시 계정은 UI에서 1회 생성합니다.
- 기본 용도:
  - web root 상태 확인
  - admin 페이지 상태 확인
  - `/api/health`, `/api/ping` 응답 확인

### sqlite-web

- 직접 접근: `http://localhost:3301/db/`
- 공식 dev 접근: `http://localhost:8080/db/`
- DB 파일: `data/db/db.sqlite`
- 기본 설정:
  - 단일 DB 파일만 노출
  - read-only 모드
  - 비밀번호 보호 (`SQLITE_WEB_PASSWORD`)

sqlite-web은 실제 SQLite 파일 row를 직접 보여주며, 테이블 browse/query를 가볍게 확인하는 용도입니다.

## 데이터 흐름

### admin-web에서 유저 추가

```text
admin-web
  -> /api/admin/register
  -> apps/api AuthService.registerAdmin()
  -> apps/db-server /internal/players
  -> data/db/db.sqlite players insert
  -> /internal/player-creation-logs
  -> data/db/db.sqlite player_creation_logs insert
  -> Grafana SQLite Row Browser refresh
```

## 문제 해결

### sqlite-web 접속이 안 될 때

1. DB 파일이 존재하는지 확인합니다.

   ```bash
   ls -l data/db/db.sqlite
   ```

2. 모니터링 컨테이너를 다시 실행합니다.

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d uptime-kuma sqlite-web
   ```

3. 브라우저 접근 경로가 `http://localhost:8080/db/`인지 확인합니다.
