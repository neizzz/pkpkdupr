# PKELO 이미지 빌드

이 브랜치는 PKELO 앱 소스와 Kakao 로그인·PWA 안내 UI만 관리합니다.
공용 SWAG, TLS 인증서, 두 도메인 라우팅, 운영 env와 서버 배포 스크립트는 `infra` 브랜치가 소유합니다.

## GitHub Actions

`build-app-images` workflow를 수동 실행할 때 브랜치로 `main`을 선택하고,
`image_tag`에 PKELO을 구분할 수 있는 고유 태그를 입력합니다. workflow는 서버에 접속하거나 운영 시크릿을 읽지 않습니다.

선택한 브랜치의 소스가 빌드되며, 태그는 이미지 식별에만 사용합니다. API 주소는 운영 브라우저 호스트에서 런타임으로 계산하므로 별도 입력하지 않습니다.

이미지 push 뒤에는 서버의 공용 infra checkout에서 해당 태그를 사용해 PKELO 스택만 반영합니다.

```bash
cd /opt/pkpkdupr
git switch infra
git pull --ff-only origin infra
bash scripts/manual-deploy.sh --image-tag '<pkelo-tag>' --stack pkelo
```

PKELO 임시 안내·점검 모드도 공용 infra checkout의 `scripts/pkelo-notice.sh`에서 관리합니다. 이 앱 브랜치에는 SWAG 설정이나 운영 인증서 파일을 두지 않습니다.

New Relic APM 및 Synthetic 운영 설정은 [New Relic 관측성 가이드](./new-relic.md)를 따릅니다.

## 인증 전송 보안

운영 PKELO 사용자 웹은 API와 Kakao 로그인 시작 URL을 HTTPS로만 생성합니다. 개발 모드와 `localhost`, `127.0.0.1`, `::1` loopback HTTP는 로컬 개발 예외이며, 비-loopback `http:` 설정은 브라우저가 요청을 보내기 전에 실패합니다. 관리자 웹은 `https://admin.pkelo.app/`의 상대 `/api` 경로만 사용합니다.

Kakao OAuth 인가 코드·일회성 handoff/registration ticket·JWT 및 관리자 비밀번호 응답은 `Cache-Control: no-store`로 반환합니다. Kakao callback의 성공·실패 리다이렉트에는 `Referrer-Policy: no-referrer`를 반환합니다. 비밀번호, access token, OAuth 코드, ticket, 요청 본문을 브라우저·proxy·API 로그 또는 New Relic 등 텔레메트리 속성에 기록하지 않습니다. TLS/HSTS, 공개 포트 차단과 배포 후 외부 검증은 infra 브랜치의 배포 가이드를 따릅니다.
