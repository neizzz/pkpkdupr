# PkpkDupr 이미지 빌드

이 브랜치는 `pkpkdupr.duckdns.org` 앱 소스만 관리합니다.
공용 SWAG, TLS 인증서, 두 도메인 라우팅, 운영 env와 서버 배포 스크립트는 `infra` 브랜치가 소유합니다.

## GitHub Actions

`build-app-images` workflow를 수동 실행할 때 브랜치로 `pkpkdupr`를 선택하고,
`image_tag`에 PkpkDupr를 구분할 수 있는 고유 태그를 입력합니다.

선택한 브랜치의 소스가 빌드되며, 태그는 이미지 식별에만 사용합니다. API 주소는 운영 브라우저 호스트에서 런타임으로 계산하므로 별도 입력하지 않습니다.

workflow는 GHCR 이미지만 push하며 운영 시크릿을 읽지 않습니다.

이미지 push 뒤에는 공용 infra checkout에서 해당 태그를 사용해 PkpkDupr 스택만 반영합니다.

```bash
bash scripts/manual-deploy.sh --image-tag '<pkpkdupr-tag>' --stack pkpkdupr
```
