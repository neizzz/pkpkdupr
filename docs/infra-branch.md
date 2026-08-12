# 공용 배포 인프라

`infra` 브랜치는 두 앱의 서버 설정만 소유합니다.

- 하나의 SWAG가 443과 기존 pkpkdupr용 3333을 점유합니다. PKELO는 `pkelo.app`과 `admin.pkelo.app`을 443으로만 분기합니다.
- DuckDNS 인증서와 PKELO Cloudflare DNS-01 인증서를 각각 갱신하며, 각 앱의 API·MySQL·업로드·JWT는 분리합니다.
- `scripts/manual-deploy.sh --stack pkpkdupr|pkelo`와 `scripts/pkelo-notice.sh`는 이 브랜치 checkout에서만 실행합니다.

## 서버 checkout

운영 서버의 `/opt/pkpkdupr`는 항상 이 브랜치를 유지합니다. 앱 소스 브랜치로 checkout을 전환하지 않습니다.

```bash
cd /opt/pkpkdupr
git fetch origin
git switch infra
git pull --ff-only origin infra
```

GitHub Actions 이미지는 각 앱 브랜치에서 별도로 만듭니다.

- `pkpkdupr` 브랜치: `pkpkdupr-<SHA>` 태그
- `main` 브랜치: `pkelo-<SHA>` 태그

이미지가 push된 뒤 이 checkout에서 해당 앱만 갱신합니다.

```bash
bash scripts/manual-deploy.sh --image-tag '<pkpkdupr-tag>' --stack pkpkdupr
bash scripts/manual-deploy.sh --image-tag '<pkelo-tag>' --stack pkelo
```

공용 proxy를 중단하거나 다른 앱을 재생성하지 않고, 대상 Compose project만 갱신합니다.

## 비밀번호 전송 보안

- SWAG는 443과 기존 pkpkdupr용 3333 TLS 포트만 외부에 노출합니다. PKELO의 `pkelo.app`과 `admin.pkelo.app` 요청은 443으로만 제공하며, 동일 호스트의 3333 요청은 차단합니다. HTTP 80과 앱 API 4000, DB 포트는 공개하지 않습니다.
- `pkpkdupr` 게이트웨이는 두 TLS server 블록에서 `Strict-Transport-Security: max-age=31536000`을 반환합니다. `includeSubDomains`와 `preload`는 사용하지 않습니다.
- API의 가입·로그인·비밀번호 변경·관리자 초기화·관리자 비밀번호 확인 응답은 `Cache-Control: no-store`를 반환해야 합니다. 비밀번호, access token, 요청 본문을 proxy/API 로그나 텔레메트리 속성에 기록하지 않습니다.
- 배포 뒤 외부 환경에서 443·3333의 인증서와 HSTS 응답 헤더를 확인하고, 4000과 DB 포트에 연결할 수 없는지 점검합니다. 로컬 loopback 개발 HTTP는 운영 전송 보장의 예외입니다.
