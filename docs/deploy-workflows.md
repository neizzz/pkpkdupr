# PKELO 이미지 빌드

이 브랜치는 PKELO 앱 소스와 Kakao 로그인·PWA 안내 UI만 관리합니다.
공용 SWAG, TLS 인증서, 두 도메인 라우팅, 운영 env와 서버 배포 스크립트는 `infra` 브랜치가 소유합니다.

## GitHub Actions

`build-app-images` workflow를 수동 실행할 때 PKELO는 `source_ref`와 `api_base_url`을 비우고,
`image_tag`에 `pkelo-<8자리 SHA>` 형식의 고유 태그를 입력합니다. workflow는 서버에 접속하거나 운영 시크릿을 읽지 않습니다.

이미지 push 뒤에는 공용 infra checkout에서 해당 태그를 사용해 PKELO 스택만 반영합니다.

```bash
bash scripts/manual-deploy.sh --image-tag '<pkelo-tag>' --stack pkelo
```

PKELO 임시 안내·점검 모드도 공용 infra checkout의 `scripts/pkelo-notice.sh`에서 관리합니다. 이 앱 브랜치에는 SWAG 설정이나 운영 인증서 파일을 두지 않습니다.
