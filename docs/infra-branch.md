# 공용 배포 인프라

`infra` 브랜치는 두 앱의 서버 설정만 소유합니다.

- 하나의 SWAG가 443·3333을 점유하고 `pkpkdupr.duckdns.org`와 `pkelo.app`을 `server_name`으로 분기합니다.
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
