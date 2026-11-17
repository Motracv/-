# 공용 온라인 서버

- Sites project: `appgprj_6afb8f3aa8cc8191b256dffc1b94eccc`
- URL: https://motracv-card-room.densedormouse4.chatgpt.site
- D1 binding: `DB`; tables: `rooms`, `accounts`, `account_sessions`, `login_challenges`, `match_awards`.
- 별도 Sites 소스 체크아웃: `/workspace/sites/motracv-card-room` (세션 작업 공간).
- 게임의 `engine.js`, `online/worker.mjs`, `online/accounts.mjs`를 Sites 소스 `src/`에 동기화한 후 빌드합니다. `scripts/build.mjs`는 세 모듈을 하나의 Worker ESM으로 묶습니다.
- `.openai/hosting.json`의 `d1`은 문자열 `DB`입니다. Drizzle 생성 마이그레이션과 메타데이터를 소스 및 배포 아카이브에 포함합니다. 배포된 마이그레이션은 변경하지 않고 다음 마이그레이션을 추가합니다.
- 배포 아카이브는 루트 `.openai/hosting.json`, `dist/server/index.js`, `drizzle/`를 포함해야 합니다. 인증 정보는 저장소에 넣지 않습니다.
- 서버 정책/엔진 변경 시 GitHub Pages와 Sites 서버를 함께 갱신해야 합니다.

공개 API는 닉네임 기반 친선 게임용입니다. 방 코드로 입장하고 개인 복귀 토큰으로 행동 권한을 검증합니다. 방 목록과 타인 토큰/손패를 공개하는 API는 없습니다.

배포 v3: 소스 `290e71c071bda650ec2da975d6d438188df9623e`. 1초 폴링, 접속 상태는 최소5초 간격 저장. 변경 없는 조회는 D1에 쓰지 않고, 버전 충돌은 제한된 임의 지연 후 재시도합니다.

배포 v4 (2026-11-17): 소스 `d940f44edb54a56b806ed6a3747ba91f8d721817`. 카드 31~40, 손패에 따른 공격/회복 뽑기 보정, 최대 80개 연출 이벤트를 반영했습니다. 기존 공개 접속 범위와 D1 스키마를 유지하며, 상태는 기존 방 저장 형식과 호환됩니다.

배포 v5 (2026-11-17): 소스 `52e825e0b5c67d85072014c4e9287670d13aef67`. Google 서명 확인·일회용 로그인 요청·해시 세션, 영구 경험치 원장, 계정 삭제를 추가했습니다. `drizzle/0001_clammy_azazel.sql`은 기존 rooms 마이그레이션을 보존한 추가 마이그레이션입니다. 배포 `appgdep_6afbe3fdb13c8191a6b65555cd6240b8` 성공. 공개 접속 범위와 게스트 대전을 유지합니다.

현재 **`GOOGLE_CLIENT_ID`가 미설정**이어서 실제 로그인은 비활성입니다. 운영자에게 ID를 받은 뒤 Sites 환경 변수로 설정하고 저장된 버전을 다시 배포해야 합니다. [설정 안내](GOOGLE_LOGIN.md)를 따르며 Google 클라이언트 보안 비밀번호는 사용하지 않습니다. 설정 API와 게임 계정 창은 이 대기 상태를 명확히 표시합니다.
