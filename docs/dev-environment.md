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
# env/pkelo.real-kakao.env에 개발 앱의 REST API 키, Client Secret, Admin Key 입력
pnpm dev:real-kakao
```

`dev:real-kakao`는 `USER_AUTH_PROVIDER=kakao`, REST API 키, Client Secret, Admin Key, 그리고 callback origin 일치를 확인한 뒤에만 서비스를 시작합니다. Admin Key는 회원 탈퇴 시 카카오 앱 연결 해제에만 사용하며 누락되면 시작 단계에서 설정 오류를 표시합니다. 카카오는 로그인 완료 후 서버가 아니라 같은 브라우저를 `localhost` callback으로 이동시키며, Vite가 `/auth`를 로컬 API로 프록시합니다. 따라서 같은 PC 브라우저에서는 동작하지만 휴대폰 같은 다른 기기의 `localhost`는 개발 PC를 가리키지 않습니다.

회원 탈퇴를 테스트하기 전에는 카카오디벨로퍼스에서 REST API 키와 Admin Key가 같은 개발 앱의 키인지 확인합니다. 또한 `[앱] → [플랫폼 키] → [어드민 키]`에서 사용 중인 키의 호출 허용 API에 `카카오 로그인 → 연결 해제(Unlink)`를 활성화해야 합니다. 설정이나 `env/pkelo.real-kakao.env`를 변경한 뒤에는 `pnpm dev:real-kakao`를 다시 시작합니다.

연결 해제 실패 시 브라우저에는 `KAKAO_UNLINK_FAILED`만 표시되고, 실제 원인은 API 서버의 `[KAKAO] Unlink failed` 로그에서 확인합니다. 로그에는 키와 카카오 회원번호를 남기지 않습니다.

| 카카오 코드 | 의미 | 확인할 항목 |
| --- | --- | --- |
| `-3` | 필요한 기능 또는 호출 허용 API가 비활성화됨 | 어드민 키의 `카카오 로그인 → 연결 해제` 허용 여부 |
| `-5` | API 호출 권한 없음 | 사용 중인 어드민 키의 권한과 앱 설정 |
| `-101` | 해당 앱에 연결되지 않은 회원번호 | 로그인에 사용한 앱과 어드민 키의 앱이 같은지, 기존 로컬 DB identity가 다른 개발 앱에서 생성되지 않았는지 |
| `-401` | 인증 키가 유효하지 않음 | Admin Key 값과 재시작 여부 |

현재 카카오 로그인에서는 카카오 계정 식별자만 사용합니다. 이름·성별은 신규 사용자가 로그인 후 표시되는 PKELO 프로필 만들기 화면에서 직접 입력하고 프로필 이미지는 선택할 수 있습니다. 카카오 본인인증 정보와 생년월일 수집은 추후 기능으로 보류했습니다.

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
