# 학교용병단 Android 배포 준비

현재 웹 게임은 HTTPS 계정 로그인, PWA 설치, 화면 안전 영역, 접속 실패 재시도, 모션 줄이기, 계정 삭제 경로를 제공합니다. 이번 업데이트는 플레이스토어에 앱을 등록하거나 배포하지 않습니다.

## 준비된 경로

- 시작 화면: https://motracv.github.io/-/school.html
- 개인정보 안내: https://motracv.github.io/-/privacy.html
- 외부 계정 삭제: https://motracv.github.io/-/delete-account.html
- 게임 내부 삭제: 내 계정 → 게임 계정 삭제 → DELETE 확인
- 웹 앱 매니페스트: school.webmanifest (192/512 아이콘, 가로 화면, 전체화면)
- 인증 응답과 계정 API는 서비스워커에 캐시하지 않습니다. 로그인 전에는 플레이할 수 없습니다.

## Android 패키징 시

Google 로그인을 제한하는 내장 WebView보다 Chrome 기반 Trusted Web Activity를 권장합니다. 앱 패키지 이름과 Play App Signing 인증서가 확정되면, **도메인 루트** `https://motracv.github.io/.well-known/assetlinks.json`에 패키지와 SHA-256 인증서를 연결해야 합니다. 프로젝트 경로 `/-/.well-known/`는 해당 루트의 대체가 아닙니다. 루트 게시 권한이 없으면 별도 게임 도메인을 연결하거나 브라우저 표시를 유지해야 합니다.

실제 서명 키·비밀번호·운영 접속 코드·서버 세션은 소스 및 공개 Pages에 넣지 않습니다. 기존 키를 임의로 새로 만들거나 교체하지 않습니다.

## 등록 전에 남은 작업

1. Play Console의 앱 ID, 스토어 설명·스크린샷·연락처, 연령 등급·대상 연령·데이터 보안 양식 작성.
2. 등록 시점 Google Play의 최신 target SDK 및 테스트 요구사항에 맞춘 Android 빌드와 내부 테스트.
3. Play App Signing 인증서 연결 및 TWA에서 Google 로그인·로그아웃·재로그인·계정 삭제 실기기 점검.
4. 작은 휴대폰/태블릿, 키보드 열린 이름 입력, 화면 회전, 홈 복귀, 시스템 뒤로가기, 네트워크 단절/복구, 새 버전 캐시 교체 확인.
5. 결제를 도입할 경우 Play 결제 및 서버 영수증 검증은 별도 구현합니다. 현재 유료 결제는 없습니다.

자동 확인 범위: 계정/이름 중복, 튜토리얼 진행 저장, 잠금 해제 입력, 복도 자동 진행, 비공개 테스트 계정 격리. 현재 실행 환경에서 실제 브라우저·Android 기기 검수는 수행하지 못했습니다.
