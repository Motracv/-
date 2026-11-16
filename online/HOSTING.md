# 공용 온라인 서버

- Sites project: `appgprj_6afb8f3aa8cc8191b256dffc1b94eccc`
- URL: https://motracv-card-room.densedormouse4.chatgpt.site
- D1 binding: `DB`; table: `rooms`.
- 별도 Sites 소스 체크아웃: `/workspace/sites/motracv-card-room` (세션 작업 공간).
- 게임의 `engine.js`와 `online/worker.mjs`를 Sites 소스 `src/`에 동기화한 후 빌드합니다. `scripts/build.mjs`는 Worker ESM을 생성합니다.
- `.openai/hosting.json`의 `d1`은 문자열 `DB`입니다. Drizzle 생성 마이그레이션과 메타데이터를 소스 및 배포 아카이브에 포함합니다. 배포된 마이그레이션은 변경하지 않고 다음 마이그레이션을 추가합니다.
- 배포 아카이브는 루트 `.openai/hosting.json`, `dist/server/index.js`, `drizzle/`를 포함해야 합니다. 인증 정보는 저장소에 넣지 않습니다.
- 서버 정책/엔진 변경 시 GitHub Pages와 Sites 서버를 함께 갱신해야 합니다.

공개 API는 닉네임 기반 친선 게임용입니다. 방 코드로 입장하고 개인 복귀 토큰으로 행동 권한을 검증합니다. 방 목록과 타인 토큰/손패를 공개하는 API는 없습니다.

배포 v3: 소스 `290e71c071bda650ec2da975d6d438188df9623e`. 1초 폴링, 접속 상태는 최소5초 간격 저장. 변경 없는 조회는 D1에 쓰지 않고, 버전 충돌은 제한된 임의 지연 후 재시도합니다.
