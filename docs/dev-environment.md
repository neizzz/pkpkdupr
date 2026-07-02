# PkpkDupr dev 환경 구조와 흐름

이 문서는 로컬 개발 환경에서 앱, DB, 모니터링, Grafana row browser가 어떻게 연결되는지 설명합니다.

## 실행 명령

### 앱 개발 서버

```bash
pnpm dev
```

`pnpm dev`는 테스트/개발용 실행 흐름입니다.

- `apps/web`: `http://localhost:3000`
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

- Prometheus: 컨테이너 내부 `:9090`
- Grafana 직접 접근: `http://localhost:3300/grafana/`
- 공식 dev 접근: `http://localhost:3000/grafana/`
- SQLite exporter: 컨테이너 내부 `db-exporter:9697`

종료:

```bash
pnpm dev:monitoring:down
```

## 시스템 구조

```text
┌────────────────────────────┐
│ apps/web                   │
│ Vite dev server :3000      │
│ - /api     -> :4000        │
│ - /grafana -> :3300        │
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
│ db-exporter       │   │ Grafana dev SQLite plugin   │
│ Prometheus metrics│   │ row browser datasource      │
└─────────┬─────────┘   └─────────────┬──────────────┘
          │                           │
          ▼                           ▼
┌───────────────────┐        ┌────────────────────────┐
│ Prometheus        │        │ Grafana :3300/grafana  │
│ API/SQLite metrics│        │ dashboards             │
└───────────────────┘        └────────────────────────┘
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

## Grafana 대시보드

dev Grafana는 `docker-compose.dev.yml`에서 별도 이미지 `pkpkdupr-grafana-dev`를 빌드합니다.

추가 구성:

- SQLite datasource plugin: `frser-sqlite-datasource`
- plugin path: `/opt/grafana-plugins`
- SQLite datasource: `SQLite Dev DB`
- datasource DB path: `/var/lib/pkpkdupr/db/db.sqlite`

### SQLite Row Browser

접속:

```text
http://localhost:3000/grafana/d/sqlite-row-browser
```

패널:

- `Database File Size`
- `Players Count`
- `Creation Logs Count`
- `Status Change Logs Count`
- `Matches Count`
- `Match Scores Count`
- `Players`
- `Player Creation Logs`
- `Player Status Change Logs`
- `Matches`
- `Match Scores`

이 대시보드는 Prometheus 메트릭이 아니라 Grafana SQLite datasource가 `data/db/db.sqlite`를 읽어 실제 row를 보여줍니다.

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

### SQLite 메트릭 수집

```text
data/db/db.sqlite
  -> db-exporter /metrics
  -> Prometheus scrape
  -> Grafana Prometheus datasource
```

현재 SQLite row browser는 직접 SQLite datasource를 사용하므로, row 조회 자체는 Prometheus scrape 상태와 독립적입니다.

## 문제 해결

### Row Browser가 No data로 보일 때

1. Grafana dev 이미지에 SQLite plugin이 로드됐는지 확인합니다.

   ```bash
   docker logs pkpkdupr-grafana --tail 200
   ```

   정상 로그:

   ```text
   Plugin registered pluginId=frser-sqlite-datasource
   ```

2. DB 파일이 존재하는지 확인합니다.

   ```bash
   ls -l data/db/db.sqlite
   ```

3. Grafana를 다시 빌드/실행합니다.

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build grafana
   ```

### SQLite metrics가 No data로 보일 때

DB 파일 생성 전에 `db-exporter`가 먼저 떠 있으면 exporter를 재시작합니다.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart db-exporter
```
