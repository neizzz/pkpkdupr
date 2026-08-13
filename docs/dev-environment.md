# PKELO 개발 환경

로컬 개발은 Docker MySQL과 Adminer를 사용합니다. 기존 SQLite 파일은 데이터 이관용 원본으로만 유지합니다.

## 실행

```bash
pnpm dev                 # MySQL 준비 후 web/admin/api/db-server 실행
pnpm dev:db              # MySQL만 기동
pnpm dev:db:down         # MySQL 중지
pnpm dev:db-browser      # Adminer 기동 (http://localhost:3302/)
pnpm dev:db-browser:down
```

사용자 앱은 `http://localhost:8443/login`에서 엽니다.

`pnpm dev`는 다음 환경 변수를 DB 서버에 주입하고 개발 mock 데이터를 넣습니다.

```text
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=pkelo_dev
DB_USER=pkelo_dev
DB_PASSWORD=<MYSQL_PASSWORD>
ENABLE_DEV_MOCK_DATA=true
```

## 구조

```text
apps/web :8443 ── /api ──> apps/api :4001
                                 │ internal HTTP
                                 ▼
                        apps/db-server :5002
                                 │ mysql2 + Drizzle
                                 ▼
                         MySQL 9.7 :3307
                                 ▲
                     Adminer :3302 (read-only viewer account)
```

Vite는 `/api`, `/auth`, `/uploads`, `/db`를 각각 API 또는 Adminer 개발 서비스로 프록시합니다.

## Adminer

- 직접 접근: `http://localhost:3302/`
- Vite 경유 접근: `http://localhost:8443/db/`
- 서버는 `mysql`, 데이터베이스는 `pkelo_dev`를 입력합니다.
- 조회에는 `.env`의 `MYSQL_VIEWER_USER` / `MYSQL_VIEWER_PASSWORD`를 사용합니다. 이 계정은 `SELECT`, `SHOW VIEW` 권한만 가집니다.

## HTTPS 프록시와 카카오 로그인

`neiz-office2.fedev.kakao.com`, `neiz-home2.fedev.kakao.com`은 개발 Vite 허용 host입니다. 실카카오 로그인은 사용할 프록시 도메인을 카카오디벨로퍼스 Redirect URI에 등록한 뒤, `env/pkelo.dev.env`에 같은 origin을 설정합니다.

```env
PKELO_DEV_WEB_ORIGIN=https://neiz-office2.fedev.kakao.com
KAKAO_WEB_ORIGIN=https://neiz-office2.fedev.kakao.com
KAKAO_REDIRECT_URI=https://neiz-office2.fedev.kakao.com/auth/kakao/callback
```

## SQLite 데이터 이관

운영 전환은 쓰기 중단 중에 수행합니다. 이관 명령은 원본 SQLite를 변경하지 않으며 대상 MySQL이 비어 있지 않으면 실패합니다.

```bash
# 운영 서버의 infra checkout에서: SQLite 백업 생성, MySQL 준비, 데이터 이관 및 검증
cd /opt/pkpkdupr
git switch infra
git pull --ff-only origin infra
PKPKDUPR_DEPLOY_PATH=/opt/pkpkdupr \
  bash scripts/migrate-sqlite-to-mysql.sh

# 로컬에서 직접 실행할 때
DB_PASSWORD=<MYSQL_PASSWORD> \
SQLITE_SOURCE_URL=file:$PWD/data/db/db.sqlite \
  pnpm db:import-sqlite
```

이관은 선수, 경기, 점수, 참가자, 세션, 승인, 평점 변동·감사 로그를 복사하고 테이블별 행 수와 Unix 초 단위 timestamp를 검증합니다.
