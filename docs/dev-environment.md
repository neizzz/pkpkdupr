# PKELO 개발 환경

로컬 개발은 Docker MySQL과 Adminer를 사용합니다. 기존 SQLite 파일은 데이터 이관용 원본으로만 유지합니다.

## 실행

```bash
pnpm dev                 # MySQL 준비 후 web/admin/api/db-server 실행
pnpm dev:real-kakao      # 별도 카카오 개발 앱으로 실카카오 로그인 실행
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

## 로컬 실카카오 로그인

`pnpm dev`는 `kakao-mock`을 유지합니다. 실제 카카오 로그인은 운영 앱과 분리한 카카오 개발 앱을 만들고 아래 절차로 실행합니다.

```env
# 카카오디벨로퍼스 개발 앱 설정
# 1. [카카오 로그인] 사용 설정을 ON으로 변경
# 2. Redirect URI에 아래 값을 정확히 등록
http://localhost:8443/auth/kakao/callback
```

```bash
cp env/pkelo.real-kakao.env.example env/pkelo.real-kakao.env
# env/pkelo.real-kakao.env에 개발 앱의 REST API 키와 Client Secret 입력
pnpm dev:real-kakao
```

`dev:real-kakao`는 `USER_AUTH_PROVIDER=kakao`, REST API 키, Client Secret, 그리고 callback origin 일치를 확인한 뒤에만 서비스를 시작합니다. 카카오는 로그인 완료 후 서버가 아니라 같은 브라우저를 `localhost` callback으로 이동시키며, Vite가 `/auth`를 로컬 API로 프록시합니다. 따라서 같은 PC 브라우저에서는 동작하지만 휴대폰 같은 다른 기기의 `localhost`는 개발 PC를 가리키지 않습니다.

카카오 본인확인정보(법정 실명·성별·생년월일)를 이용한 자동 가입은 카카오 제휴 승인이 전제입니다. 승인 후에만 `KAKAO_CONFIDENTIAL_USER_INFO_APPROVED=true`를 설정하세요. 승인되지 않은 상태에서는 실카카오 로그인을 시작하지 않도록 서버가 차단합니다.

현재 PKELO의 로그아웃은 PKELO 세션만 삭제하며 카카오계정 로그아웃을 요청하지 않습니다. 따라서 카카오디벨로퍼스의 로그아웃 Redirect URI는 등록하지 않아도 됩니다. 카카오계정 로그아웃을 추가할 때만 별도 URI를 등록합니다.

### 외부 기기 HTTPS 테스트

`neiz-office2.fedev.kakao.com`, `neiz-home2.fedev.kakao.com`은 개발 Vite 허용 host입니다. 외부 기기 테스트가 필요하면 해당 HTTPS 프록시 origin을 카카오디벨로퍼스 Redirect URI에 등록하고, `env/pkelo.real-kakao.env`의 `PKELO_DEV_WEB_ORIGIN`, `KAKAO_WEB_ORIGIN`, `KAKAO_REDIRECT_URI`를 모두 같은 origin으로 변경합니다.

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
