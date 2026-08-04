# 두 도메인 배포 운영

한 SWAG 인그레스에서 `pkpkdupr.duckdns.org`와 `pkelo.app`을 동시에 운영합니다.
두 앱은 web 이미지는 공유하지만 API, MySQL, 업로드 경로, JWT, 관리자 계정 및 인증서 발급 자격증명을 공유하지 않습니다.

## 운영 환경파일

운영 서버의 `/opt/pkpkdupr/env/`에 다음 세 파일을 생성합니다. 설치·업데이트 스크립트는 이 파일들을 생성하거나 수정하지 않습니다.

```bash
cd /opt/pkpkdupr
mkdir -p env
cp env/shared.env.example env/shared.env
cp env/pkpkdupr.env.example env/pkpkdupr.env
cp env/pkelo.env.example env/pkelo.env
chmod 600 env/*.env
```

| 파일 | 소유 설정 |
| --- | --- |
| `shared.env` | 이미지 태그, 외부 포트, 공용 게이트웨이 네트워크, SWAG 런타임 계정 |
| `pkpkdupr.env` | 기존 DuckDNS 앱의 도메인·DuckDNS 토큰·JWT·관리자·MySQL·업로드 경로와 `USER_AUTH_PROVIDER=password` |
| `pkelo.env` | `pkelo.app`의 도메인·Cloudflare 토큰·JWT·관리자·MySQL·업로드 경로와 Kakao OAuth 시크릿 |

두 앱 파일은 모두 같은 일반 변수명(`DOMAIN`, `JWT_SECRET`, `MYSQL_*`, `API_ADMIN_*`, `CORS_ADDITIONAL_ORIGINS`)을 사용합니다. `pkelo`용 접두사 변수는 사용하지 않습니다. 두 `JWT_SECRET`은 반드시 서로 달라야 합니다.

## PKELO Kakao 로그인

`pkelo.env`에는 아래 값을 반드시 설정합니다. 이 값은 `pkelo-api` 컨테이너에만 전달되며 기존 `pkpkdupr` API나 Compose 렌더링에는 포함되지 않습니다.

```dotenv
USER_AUTH_PROVIDER=kakao
KAKAO_REST_API_KEY=<Kakao REST API 키>
KAKAO_CLIENT_SECRET=<Kakao client secret>
KAKAO_REDIRECT_URI=https://pkelo.app/auth/kakao/callback
KAKAO_WEB_ORIGIN=https://pkelo.app
```

Kakao Developers 콘솔에는 `https://pkelo.app/auth/kakao/callback`을 Redirect URI로 정확히 등록합니다. 일반 사용자는 Kakao 로그인만 사용하며 첫 로그인 뒤 PKELO 사용자명과 성별을 한 번 입력합니다. 관리자는 계속 `https://pkelo.app:3333/admin/`에서 별도 아이디·비밀번호로 로그인합니다.

로컬은 `pnpm dev:pkelo`을 사용하면 `USER_AUTH_PROVIDER=kakao-mock` 기본값으로 외부 Kakao 호출 없이 같은 state·callback·onboarding 흐름을 검증합니다. 운영 env에서 `kakao-mock`은 설치·업데이트 단계와 API 시작 단계에서 모두 거부됩니다.

기존 서버 전환 시에는 기존 `/opt/pkpkdupr/.env`의 `DOMAIN`, DuckDNS 토큰, JWT, 관리자, `MYSQL_*` 값을 `pkpkdupr.env`로 그대로 옮깁니다. 특히 기존 `MYSQL_*`와 `APP_DATA_PATH=/opt/pkpkdupr/data`를 바꾸지 않아야 기존 `pkpkdupr_mysql-data` 볼륨과 업로드가 유지됩니다. 기존 `.env`는 확인이 끝날 때까지 보관합니다.

## Compose와 인증서

- `docker-compose.proxy.yml`: 외부 `443`, `3333`을 바인딩하는 DuckDNS SWAG와 공용 `pkpkdupr-gateway` 네트워크를 생성합니다.
- `docker-compose.pkelo-certificate.yml`: 포트를 열지 않는 Cloudflare DNS-01 SWAG입니다. `pkelo.app` 인증서를 `/opt/pkpkdupr/data/pkelo-certs`에 갱신합니다.
- `docker-compose.yml` + `docker-compose.pkpkdupr-gateway.yml`: 기존 서비스명과 `mysql-data` 볼륨을 유지하는 기본 앱입니다. 프록시에는 `pkpkdupr-web`, `pkpkdupr-api` 등의 고유 별칭으로 연결됩니다.
- `docker-compose.pkelo.yml` + `docker-compose.pkelo-gateway.yml`: 새 MySQL 볼륨과 `data/uploads/pkelo/avatars`를 쓰는 `pkelo` 전용 앱입니다.

주 SWAG 설정은 `/opt/pkpkdupr/data/certs/nginx/site-confs/default.conf`에 생성됩니다. `pkelo.app` SNI는 `/opt/pkpkdupr/data/certs/nginx/pkelo-ssl.conf`를 통해 읽기 전용으로 공유한 Cloudflare 인증서를 사용합니다. DuckDNS와 Cloudflare credential 파일만 스크립트가 `600` 권한으로 동기화합니다.

## 설치·업데이트·롤백

```bash
# 최초 설치 또는 인증서/SWAG 설정 복구: 두 앱을 함께 초기화
bash scripts/install-server.sh

# 이미지 배포: 기본값은 두 앱
bash scripts/manual-deploy.sh --image-tag <IMAGE_TAG>

# 한 앱만 독립 배포·롤백
bash scripts/manual-deploy.sh --image-tag <IMAGE_TAG> --stack pkpkdupr
bash scripts/manual-deploy.sh --image-tag <IMAGE_TAG> --stack pkelo
```

`--stack`은 대상 앱 컨테이너만 pull/recreate합니다. 공용 SWAG와 인증서 컨테이너는 기동·설정 갱신될 수 있지만 다른 앱의 web/API/MySQL/DB 서버는 재생성하지 않습니다. SQLite→MySQL 이관은 기존 앱에만 적용되므로 `--migrate-sqlite --stack pkelo`은 허용하지 않습니다.

## 배포 성공 기준과 New Relic

수동 배포 스크립트는 대상 Docker Compose 서비스가 `running` 상태인지 확인한 뒤 종료합니다. 호스트 Node.js나 배포 스크립트의 외부 HTTPS 재시도는 사용하지 않습니다. 공개 가용성·응답 내용·TLS 상태는 New Relic에서 확인합니다.

### pkpkdupr APM

`/opt/pkpkdupr/env/pkpkdupr.env`에만 아래 값을 설정합니다. key 값은 Git이나 쉘 인자에 넣지 않습니다.

```dotenv
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=<new-relic-license-key>
# EU collector 계정에서만 설정
# NEW_RELIC_HOST=collector.eu01.nr-data.net
```

배포 후 New Relic APM에 `pkpkdupr-api`, `pkpkdupr-db-server`가 각각 보고되어야 합니다.

### pkpkdupr Synthetics

New Relic UI에서 TLS 검증을 켠 공개 위치 3곳, 5분 주기의 monitor 5개를 수동으로 생성합니다.

- Simple Browser: `https://pkpkdupr.duckdns.org/`
- Scripted API: `https://pkpkdupr.duckdns.org:3333/api/health` — HTTP 200, JSON `status: "ok"`
- Scripted API: `https://pkpkdupr.duckdns.org:3333/api/ping` — HTTP 200, JSON `message: "pong"`
- Simple Browser: `https://pkpkdupr.duckdns.org:3333/admin/`
- Simple Browser: `https://pkpkdupr.duckdns.org:3333/db/` — 응답 본문 `adminer`

두 Scripted API monitor에는 각각 아래 스크립트를 사용합니다. New Relic UI의 API test editor에서 URL만 바꾸지 말고 응답 본문 assertion까지 함께 설정합니다.

```js
const assert = require("assert");

$http.get("https://pkpkdupr.duckdns.org:3333/api/health", (error, response, body) => {
  assert.ifError(error);
  assert.strictEqual(response.statusCode, 200);
  const payload = typeof body === "string" ? JSON.parse(body) : body;
  assert.strictEqual(payload.status, "ok");
});
```

```js
const assert = require("assert");

$http.get("https://pkpkdupr.duckdns.org:3333/api/ping", (error, response, body) => {
  assert.ifError(error);
  assert.strictEqual(response.statusCode, 200);
  const payload = typeof body === "string" ? JSON.parse(body) : body;
  assert.strictEqual(payload.message, "pong");
});
```

`pkpkdupr-production` Alert policy에 위 monitor를 연결합니다. 외부 notification destination은 만들지 않고 New Relic Issue만 생성합니다. 공개 위치에서 `:3333` 포트가 접근 가능해야 합니다.

## GitHub Actions

`/Users/neiz/pkpkdupr/.github/workflows/deploy.yml`은 도메인 설정을 주입하지 않고 web/admin-web/api/db-server 이미지를 GHCR에 빌드·푸시만 합니다. 서버 반영은 운영자가 위 수동 명령으로 수행합니다.
