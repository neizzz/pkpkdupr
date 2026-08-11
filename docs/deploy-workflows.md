# PkpkDupr 이미지 빌드

이 브랜치는 `pkpkdupr.duckdns.org` 앱 소스만 관리합니다.
공용 SWAG, TLS 인증서, 두 도메인 라우팅, 운영 env와 서버 배포 스크립트는 `infra` 브랜치가 소유합니다.

## GitHub Actions

`build-app-images` workflow를 수동 실행할 때 브랜치로 `pkpkdupr`를 선택하고,
`image_tag`에 PkpkDupr를 구분할 수 있는 고유 태그를 입력합니다.

선택한 브랜치의 소스가 빌드되며, 태그는 이미지 식별에만 사용합니다. API 주소는 운영 브라우저 호스트에서 런타임으로 계산하므로 별도 입력하지 않습니다.

workflow는 GHCR 이미지만 push하며 운영 시크릿을 읽지 않습니다.

## 비밀번호 전송 보안

- 운영의 브라우저/API 통신은 SWAG 게이트웨이가 노출하는 TLS 443·3333 포트만 사용합니다. API 4000, DB와 내부 서비스 포트는 외부에 노출하지 않습니다.
- 가입·로그인·비밀번호 변경·관리자 초기화·관리자 비밀번호 확인 응답은 `Cache-Control: no-store`로 전달합니다. 비밀번호, access token, HTTP 요청 본문을 로그나 텔레메트리 속성에 기록하지 않습니다.
- 로컬 개발의 loopback Vite/API HTTP는 운영 전송 보장의 예외입니다. 운영 `VITE_API_BASE_URL`에는 반드시 `https://` 주소를 설정합니다.

이미지 push 뒤에는 서버의 공용 infra checkout에서 해당 태그를 사용해 PkpkDupr 스택만 반영합니다.

```bash
cd /opt/pkpkdupr
git switch infra
git pull --ff-only origin infra
bash scripts/manual-deploy.sh --image-tag '<pkpkdupr-tag>' --stack pkpkdupr
```
