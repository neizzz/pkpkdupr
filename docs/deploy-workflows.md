# PkpkDupr 이미지 빌드

이 브랜치는 `pkpkdupr.duckdns.org` 앱 소스만 관리합니다.
공용 SWAG, TLS 인증서, 두 도메인 라우팅, 운영 env와 서버 배포 스크립트는 `infra` 브랜치가 소유합니다.

## GitHub Actions

기본 `main`의 `build-app-images` workflow를 수동 실행할 때 아래 입력값을 사용합니다.

| 입력 | 값 |
| --- | --- |
| `source_ref` | `pkpkdupr` |
| `image_tag` | `pkpkdupr-<8자리 SHA>` |
| `api_base_url` | `https://pkpkdupr.duckdns.org:3333` |

workflow는 GHCR 이미지만 push하며 운영 시크릿을 읽지 않습니다.

이미지 push 뒤에는 공용 infra checkout에서 해당 태그를 사용해 PkpkDupr 스택만 반영합니다.

```bash
bash scripts/manual-deploy.sh --image-tag '<pkpkdupr-tag>' --stack pkpkdupr
```
