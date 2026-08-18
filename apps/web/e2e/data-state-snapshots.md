# 데이터 상태 스냅샷 coverage matrix

모든 기준 이미지는 저장소 루트의 `tmp/snapshots/`에 생성한다. `data-state-snapshots.spec.ts`는 모바일 project에서 실행한다.

| Surface | 진입 흐름 | with-data fixture | empty fixture | 대상 viewport | 저장 basename | 상태 | N/A 근거 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `kakao-login` | `pkelo.localhost/login` | 해당 없음 | 해당 없음 | mobile | `kakao-login.png` | captured | 서버 목록을 렌더하지 않는 카카오 인증 진입 화면 |
| `matches` | 내 매치 탭 | 매치와 세션 1개씩 | 빈 match-feed | mobile | `matches--{state}.png` | captured | |
| `match-detail` | 매치 카드 선택 | 완료 매치의 팀·점수·평점 변동 | N/A | mobile | `match-detail--with-data.png` | captured | 상세는 선택된 매치가 있어야만 열림 |
| `session-detail` | 세션 카드 선택 | 세션 내 매치 1개 | 세션 매치 배열 빈 값 | mobile | `session-detail--{state}.png` | captured | |
| `create-match-sheet` | `+ 매치 만들기` | 현재 사용자로 초기 팀 구성 | N/A | mobile | `create-match-sheet.png` | captured | 데이터 목록 대신 현재 세션 사용자만 쓰는 입력 폼 |
| `player-qr-modal` | 하단 QR 버튼 | 유효 QR payload | QR API 실패로 QR 없음 상태 | mobile | `player-qr-modal--{state}.png` | captured | |
| `members` | 플레이어 탭 | 소속·상태메시지가 서로 다른 멤버 2명 | 빈 players 배열 | mobile | `members--{state}.png` | captured | |
| `member-profile` | 멤버 행 선택 | 통계·차트·최근 매치 | 통계 0·차트/최근 매치 빈 값 | mobile | `member-profile--{state}.png` | captured | |
| `profile-match-history` | 멤버 프로필의 `전체 보기` | 완료 매치 2개 | 빈 matches 배열 | mobile | `profile-match-history--{state}.png` | captured | |
| `profile-match-detail` | 멤버·내 프로필의 최근 매치 선택 | 완료 매치와 선택한 프로필 식별 헤더 | N/A | mobile | `profile-match-detail--{member,my}.png` | captured | 상세는 선택된 매치가 있어야만 열림 |
| `my-profile` | 플레이어 탭의 `내 프로필` | 통계·최근 매치 | 통계 0·최근 매치 빈 값 | mobile | `my-profile--{state}.png` | captured | |
| `profile-settings-sheet` | 내 프로필의 `설정` | 해당 없음 | 해당 없음 | mobile | `profile-settings-sheet.png` | captured | 인증 방식만 바꾸는 입력 폼 |
| `status-message-sheet` | 내 프로필의 상태메시지 수정 | 기존 상태메시지와 배경색 | N/A | mobile | `status-message-sheet--with-data.png` | captured | 빈 메시지는 같은 편집 폼으로 구조가 바뀌지 않음 |
| `avatar-confirm-sheet` | 프로필 사진 파일 선택 | N/A | N/A | - | - | N/A | 로컬 파일 선택과 이미지 리사이즈 결과가 필요하며 서버 데이터 상태 surface가 아님 |
| `affiliations` | 클럽 탭 | 일정·공지·랭킹이 있는 활성 클럽 | 빈 clubs 배열 | mobile | `affiliations--{state}.png` | captured | |
| `club-management` | `운영진 관리` | 공지·세션·멤버 권한 | 공지·랭킹 빈 값 | mobile | `club-management--{state}.png` | captured | |
| `club-match-history` | 클럽의 매치 전체 보기 | 완료 매치 2개 | 빈 club matches 배열 | mobile | `club-match-history--{state}.png` | captured | |
| `club-create-sheet` | `+ 클럽 만들기` | 해당 없음 | 해당 없음 | mobile | `club-create-sheet.png` | captured | 서버 목록을 렌더하지 않는 입력 폼 |
| `club-member-qr-scanner-sheet` | 멤버 초대의 플레이어 QR 스캔 | N/A | N/A | - | - | N/A | 카메라 권한/실시간 영상은 로딩·권한 상태이며 이번 범위에서 제외 |
| `settings` | 설정 탭 | 해당 없음 | 해당 없음 | mobile | `settings.png` | captured | 앱 업데이트 상태는 서버 데이터 목록 surface가 아님 |
| `logout-modal` | 설정 탭의 `로그아웃` | 해당 없음 | 해당 없음 | mobile | `logout-modal.png` | captured | 확인 문구가 고정된 단일 상태 modal |
| `PWA install/update/runtime notice` | 브라우저·운영 이벤트 | N/A | N/A | - | - | N/A | 설치 이벤트·service worker·운영 503 상태는 데이터 유무가 아닌 별도 PWA/운영 검증 범위 |
