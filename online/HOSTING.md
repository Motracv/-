# 공용 온라인 서버

- Sites project: `appgprj_6afb8f3aa8cc8191b256dffc1b94eccc`
- URL: https://motracv-card-room.densedormouse4.chatgpt.site
- D1 binding: `DB`; tables: `rooms`, `accounts`, `account_sessions`, `login_challenges`, `match_awards`, `school_saves`.
- 별도 Sites 소스 체크아웃: `/workspace/sites/motracv-card-room` (세션 작업 공간).
- 게임의 `engine.js`, `school/engine.js`, `online/accounts.mjs`, `online/school.mjs`, `online/worker.mjs`를 Sites 소스 `src/`에 동기화한 후 빌드합니다. `scripts/build.mjs`는 카드 엔진 → RPG 엔진 → 계정 모듈 → RPG 모듈 → Worker 순서로 하나의 Worker ESM에 묶습니다.
- `.openai/hosting.json`의 `d1`은 문자열 `DB`입니다. Drizzle 생성 마이그레이션과 메타데이터를 소스 및 배포 아카이브에 포함합니다. 배포된 마이그레이션은 변경하지 않고 다음 마이그레이션을 추가합니다.
- 배포 아카이브는 루트 `.openai/hosting.json`, `dist/server/index.js`, `drizzle/`를 포함해야 합니다. 인증 정보는 저장소에 넣지 않습니다.
- 서버 정책/엔진 변경 시 GitHub Pages와 Sites 서버를 함께 갱신해야 합니다.

카드게임 공개 API는 닉네임 기반 친선 게임용입니다. 방 코드로 입장하고 개인 복귀 토큰으로 행동 권한을 검증합니다. 방 목록과 타인 토큰/손패를 공개하는 API는 없습니다.

## 학교용병단 카탈로그 12 운영

학교용병단은 같은 계정과 D1을 사용하되 카드게임과 별도 저장·규칙으로 동작합니다. 정적 `school.html`, `school/engine.js`, `school/art.js`, `school/client.js`, `school/style.css`, `school/presentation.js`, `school/presentation.css`, 던전 이미지 3개를 서버의 RPG 엔진·모듈과 함께 갱신합니다. 설치형 웹앱은 `school.webmanifest`, `school-sw.js`, `school/install.js`, `school/install.css`, 앱 아이콘을 함께 배포합니다. SW는 `school.html`만 제어하며 정적 학교 파일 외 API·Google·카드게임은 캐시하지 않습니다. 클라이언트와 서버는 `catalogVersion: 12`로 맞춥니다. 구버전 계정 화면의 저장·재화 사용은 426으로 거부하고 새로고침을 안내합니다.

기존 `school_saves` 행과 마이그레이션을 보존합니다. 저장 JSON의 `version: 1`은 유지하며 기존 레벨·재화·진행·미수령 방치 보상·모집 누적과 픽업 보장을 초기화하지 않습니다. [`migrations/0004_school_rankings.sql`](migrations/0004_school_rankings.sql)의 표현식 인덱스를 Sites의 다음 Drizzle 마이그레이션에 추가합니다. 별도 랭킹 테이블이나 점수 업로드 API는 없습니다.

학교 저장·행동은 Google 인증을 완료한 게임 세션이 필요합니다. `POST /api/school/rankings`는 공개 읽기 경로이며 `{catalogVersion: 9, mode: "level" | "tower"}`로 상위 50명을 조회합니다. 유효한 `X-Account-Session`이 있으면 본인 전체 순위를 추가합니다. 공개 항목은 순위·게임 단장 이름·레벨·복도 최고 층이며 Google 신원·계정 ID·토큰·전체 저장은 반환하지 않습니다. 서버의 저장된 기록만 순위에 반영하고 게스트 기록은 받지 않습니다. 응답은 `no-store`이며 계정 삭제 시 저장과 순위도 함께 제거합니다.

`GOOGLE_CLIENT_ID`는 기존 운영 값을 보존합니다. 새 OAuth 동의 범위나 클라이언트 비밀번호는 필요하지 않습니다. 배포 시 정적 화면·API의 카탈로그 일치, 무인증 저장 거부와 공개 랭킹 조회, 잘못된 버전 거부, 기존 계정 진행 보존, 계정별 순위·이름과 삭제 반영을 확인합니다. 실제 Google 계정 로그인의 검증과 테스트 서명 fixture 검증은 구분합니다. 공개 범위는 [개인정보 안내](../privacy.html)와 일치시킵니다.

위 내용은 배포 구성과 확인 항목입니다. 개별 배포 성공은 아래 기록과 [검증 기록](../VALIDATION.md)에 별도로 남깁니다.

## 기존 배포 기록

배포 v3: 소스 `290e71c071bda650ec2da975d6d438188df9623e`. 1초 폴링, 접속 상태는 최소5초 간격 저장. 변경 없는 조회는 D1에 쓰지 않고, 버전 충돌은 제한된 임의 지연 후 재시도합니다.

배포 v4 (2026-11-17): 소스 `d940f44edb54a56b806ed6a3747ba91f8d721817`. 카드 31~40, 손패에 따른 공격/회복 뽑기 보정, 최대 80개 연출 이벤트를 반영했습니다. 기존 공개 접속 범위와 D1 스키마를 유지하며, 상태는 기존 방 저장 형식과 호환됩니다.

배포 v5 (2026-11-17): 소스 `52e825e0b5c67d85072014c4e9287670d13aef67`. Google 서명 확인·일회용 로그인 요청·해시 세션, 영구 경험치 원장, 계정 삭제를 추가했습니다. `drizzle/0001_clammy_azazel.sql`은 기존 rooms 마이그레이션을 보존한 추가 마이그레이션입니다. 배포 `appgdep_6afbe3fdb13c8191a6b65555cd6240b8` 성공. 공개 접속 범위와 게스트 대전을 유지합니다.

2026-11-17 **`GOOGLE_CLIENT_ID`를 설정하고 로그인 기능을 활성화**했습니다. 운영 환경 변수 revision1을 기존 저장 버전v5에 적용한 재배포 `appgdep_6afbe846ea8c81919e3f99b17c4bd1d4`가 성공했습니다. 공개 범위와 서버 소스·D1스키마는 유지했습니다. 클라이언트 ID는 운영 설정에서 관리하며 보안 비밀번호는 사용하지 않습니다. 실제 공개 게임의 Google SDK 버튼과 Google 로그인 화면까지 확인했으며, 본인 계정으로 로그인 완료·경험치 지급의 운영 검증은 추가로 필요합니다. [설정 안내](GOOGLE_LOGIN.md)를 참고하세요.

배포 v6 (2026-11-17): 소스 `6e7a0ac27a3d9127bc1d0a7242121fd8b3b72319`. Google 공개 키 요청의 `redirect:"error"` 옵션이 Workers에서 TypeError를 발생시키는 문제를 `manual`로 수정했습니다. 리디렉션을 따라가지 않고 비정상 HTTP 응답은 계속 거부합니다. 배포 `appgdep_6afbea96985881918dcf85645f42de4e` 성공. 환경 변수 revision1과 기존 스키마·접속 범위를 유지합니다.

학교용병단 서버 v15: 소스 `f9398d38708e5a5a0bcf2804262818b8c658fa30`, 배포 `appgdep_6afc70b35bfc8191b191cafeda12b862` 성공. 카탈로그 8, SSR 기본 1%, 느려진 성장·기존 보상 보존, 단장 이름과 레벨·복도 랭킹을 반영했습니다. `drizzle/0003_school_rankings.sql`은 기존 저장을 변경하지 않고 랭킹 조회 인덱스 두 개만 추가합니다. 기존 공개 접속 범위와 환경 변수 revision1을 유지했습니다. 실제 Chromium에서 GitHub Pages 출처의 두 공개 랭킹 API가 HTTP 200으로 응답하고 공개 필드만 반환하는 것을 확인했습니다. 엔진·던전·SQLite 서버 87개 및 공용 계정·Worker 29개 검사가 통과했습니다.


학교용병단 서버 v16 (2026-11-18): 소스 `277dd6012c298fdb3eab32291677a16bff8204a5`, 배포 `appgdep_6afc7ab30a1881918827a41be32846fc` 성공. 훈련비를 `50+16L+2L²`로 완화하고 카탈로그를 9로 올렸습니다. 기존 경험치·SSR 확률·스킬·저장 구조·공개 범위와 환경 변수 revision1은 유지했습니다. 추가 데이터베이스 마이그레이션은 없습니다. 엔진·던전·SQLite 서버 88개 검증 통과. 정적 화면 패치는 전투 렌더링·복도 결과 창·오시아/라바 모션·설치형 웹앱을 포함합니다.

학교용병단 서버 v18 (2026-11-18): 소스 `a205a8d673fba71cfacdb5d34057a0f78ebc4698`, 배포 `appgdep_6afd04c493f4819184ac79e23cea4a09` 성공. 카탈로그11, UR 호라스의 독립 모집·저장되는 벚꽃의식·표식 회수·양쪽 아레나 및 피해75% 보정을 추가했다. 기존 공개 주소와 환경 변수revision1, D1스키마·기존 계정·기존 두 배너 보장을 유지한다. 구카탈로그 요청은426으로 거부하고 새화면을 안내한다.

학교용병단 서버 v19 (2026-11-18): 소스 `dfbd1dc877ef444becbea8e9fae94612479bd319`, 배포 `appgdep_6afd067e22fc8191b40c7d8e16cf2884` 성공. 카탈로그12, 세 배너의 10회 모집 가격1,600보석을 적용했다. 1회100보석과 확률·보장·기존재화는 유지하고 구버전 요청은426으로 거부한다. 공개범위·환경변수revision1·D1스키마 유지.

학교용병단 서버 v20 (2026-11-18): 소스 `f57168946e2fc425ef51b59ac5cc5e48ba445b12`, 배포 `appgdep_6afd0d84f8448191aa78e9210da164e5` 성공. 카탈로그13은 1회160/10회1600, 일일·반복·지역·업적 임무와 단장 보상, 새 코드 두 개만 허용, 호라스 피해·대상 선택 및 아레나78% 보정을 적용한다. 기존 저장에 선택 필드 `quests`를 추가하며 재화·용병·천장·과거 수령 이력은 유지한다. 구버전12의 계정 요청은426으로 거부한다. 공개범위·환경변수revision1·D1스키마 유지.
