# 데이터 상태 스냅샷 coverage matrix

테스트를 추가하기 전에 이 표를 이슈, PR 설명 또는 spec의 짧은 주석에 채운다. `상태`는 `planned`, `captured`, `N/A` 중 하나로 쓴다.

| Surface | 진입 흐름 | with-data fixture | empty fixture | 대상 viewport | 저장 basename | 상태 | N/A 근거 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `members` | 하단 탭에서 플레이어 선택 | 멤버 2명 이상, 소속/아바타 포함 | 빈 멤버 목록 | mobile, desktop | `tmp/snapshots/.../members--{state}.png` | planned | |
| `member-profile` | 멤버 행 선택 | 통계·최근 경기·평점 이력 | 경기/이력 없음 | mobile, desktop | `tmp/snapshots/.../member-profile--{state}.png` | planned | |
| `login` | `/login` | 해당 없음 | 해당 없음 | mobile, desktop | `tmp/snapshots/.../login.png` | N/A | 입력 폼은 서버 데이터 목록을 렌더하지 않음 |

## 작성 규칙

- route, keep-alive tab, drawer/sheet/modal, 상세 화면을 각각 한 행으로 적는다.
- 상위 목록에 데이터가 있어도 상세 화면의 데이터 유무가 별도 레이아웃을 만들면 별도 행을 적는다.
- empty 상태가 "아직 없음"과 "필터 결과 없음"으로 문구 또는 CTA가 다르면 각각 별도 행을 적는다.
- 화면이 하나의 상태만 갖는 경우 빈 fixture를 만들지 말고 `N/A`에 이유를 적는다.
- 완료 시 `captured` 행마다 spec 이름과 snapshot basename을 PR 설명에 연결한다.
