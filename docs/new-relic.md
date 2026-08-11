# PKELO New Relic 관측성

PKELO는 Node APM으로 `pkelo-api`, `pkelo-db-server`를 수집하고, 공개 Synthetic monitor로 외부 가용성을 확인합니다. Browser SPA 계측, 로그 전달, Infrastructure agent와 알림 정책·Workflow·notification destination은 이 구성에 포함하지 않습니다.

## APM 운영 환경 변수

New Relic 라이선스 키는 Git, CI 입력값, 이미지에 저장하지 않습니다. 공용 `infra` checkout이 관리하는 PKELO 운영 env에만 다음 값을 설정한 뒤 새 API/DB 서버 이미지를 배포합니다.

```dotenv
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=<new-relic-license-key>

# US collector가 기본값입니다. EU/JP 등 regional account만 New Relic에서 안내한 collector host로 override합니다.
# NEW_RELIC_HOST=collector.eu01.nr-data.net
```

두 컨테이너는 `NEW_RELIC_NO_CONFIG_FILE=true`로 환경 변수만 사용하며, 서비스별 이름은 Compose가 고정합니다.

- API: `pkelo-api`
- DB 서버: `pkelo-db-server`

배포 후 각 서비스에 트래픽을 발생시키고 New Relic APM에서 두 엔티티의 transaction과 외부 요청이 수집되는지 확인합니다. 키가 없거나 `NEW_RELIC_ENABLED=false`이면 에이전트는 비활성화되므로 개발 환경으로 데이터를 전송하지 않습니다.

## Synthetic monitor

New Relic UI에서 아래 monitor를 생성합니다.

- 주기: 5분
- 공개 위치: Seoul, KR (`AWS_AP_NORTHEAST_2`), Tokyo, JP (`AWS_AP_NORTHEAST_1`), Singapore, SG (`AWS_AP_SOUTHEAST_1`)
- 알림: Alert policy, condition, Workflow, notification destination을 생성하지 않음

| 이름 | 유형 | 대상 | 성공 기준 |
| --- | --- | --- | --- |
| `pkelo-web` | Simple Browser | `https://pkelo.app/` | HTTPS 페이지 로드 |
| `pkelo-api-health` | Scripted API | `https://pkelo.app:3333/api/health` | HTTP 200, JSON `status: "ok"` |
| `pkelo-api-ping` | Scripted API | `https://pkelo.app:3333/api/ping` | HTTP 200, JSON `message: "pong"` |
| `pkelo-admin` | Simple Browser | `https://pkelo.app:3333/admin/` | HTTPS 페이지 로드 |
| `pkelo-adminer` | Simple Browser | `https://pkelo.app:3333/db/` | HTTPS 페이지 로드 |

`pkelo-api-health`에는 다음 스크립트를 사용합니다.

```js
const assert = require("assert");

$http.get(
  "https://pkelo.app:3333/api/health",
  (error, response, body) => {
    assert.ifError(error);
    assert.strictEqual(response.statusCode, 200);
    const payload = typeof body === "string" ? JSON.parse(body) : body;
    assert.strictEqual(payload.status, "ok");
  },
);
```

`pkelo-api-ping`에는 URL과 assertion만 아래처럼 바꿉니다.

```js
const assert = require("assert");

$http.get(
  "https://pkelo.app:3333/api/ping",
  (error, response, body) => {
    assert.ifError(error);
    assert.strictEqual(response.statusCode, 200);
    const payload = typeof body === "string" ? JSON.parse(body) : body;
    assert.strictEqual(payload.message, "pong");
  },
);
```

생성 후 각 monitor를 수동 실행해 세 위치 모두에서 성공하는지 확인합니다. Synthetics monitor가 New Relic Issue를 자동으로 만들지 않도록 alert condition을 연결하지 않습니다.
