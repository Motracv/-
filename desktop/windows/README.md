# 학교용병단 Windows 실행기

Windows 10/11 x64에서 `School-Mercenaries.exe`를 실행하면 Edge 또는 Chrome의 앱 창으로 `https://motracv.github.io/-/school.html?desktop=1`을 직접 엽니다. 설치 버튼·관리자 권한·별도 서버 설정이 필요하지 않습니다. 게임 파일과 브라우저를 번들하지 않는 작은 실행기이며 온라인 게임 및 기존 PWA 캐시를 사용합니다.

기본 HTTPS 브라우저가 Chrome이면 Chrome, 그 외에는 Edge를 먼저 찾습니다. HKCU/HKLM의 32·64비트 App Paths와 표준 설치 경로를 읽습니다. 기본 프로필을 쓰므로 같은 브라우저·프로필의 저장을 이어갑니다. `--edge` 또는 `--chrome`으로 명시할 수 있습니다. 셸 실행, 임의 URL 인자, 레지스트리 수정, 관리자 실행, 자체 업데이트 다운로드는 사용하지 않습니다. 게임을 연 후 실행기 프로세스는 종료됩니다.

## 빌드

MinGW-w64 GCC와 windres, Python 3을 사용합니다. 아이콘은 기존 학교 문장 SVG로 만든 다중 해상도 ICO입니다.

```sh
python3 desktop/windows/build.py
# 도구 경로 지정 가능:
python3 desktop/windows/build.py --cc /path/to/x86_64-w64-mingw32-gcc --windres /path/to/x86_64-w64-mingw32-windres
```

`downloads/`에 ZIP, EXE, SHA-256 목록을 생성합니다. ZIP은 EXE와 한글 실행 안내만 포함합니다. PE 타임스탬프와 ZIP 시간은 고정합니다. 코드 서명 인증서는 없으므로 SmartScreen 평판 또는 게시자 서명은 보장하지 않습니다. 실제 Windows PC에서의 표시·로그인 확인과 교차 빌드·Wine 검증은 구분합니다.

친구에게는 [ZIP 다운로드](https://motracv.github.io/-/downloads/School-Mercenaries-Windows-1.0.0.zip) 또는 [다운로드 페이지](https://motracv.github.io/-/downloads/)를 전달하면 됩니다. 사용자 안내는 [사용방법.txt](사용방법.txt)를 참고하세요.

## 검증 — 2026-11-18

- MinGW-w64 GCC 14로 GUI x64 PE 빌드, 재빌드 시 EXE·ZIP SHA-256 동일. EXE 42,496바이트, ZIP 20,028바이트.
- DLL 의존성은 Windows 기본 `ADVAPI32`, `KERNEL32`, `msvcrt`, `SHELL32`, `USER32`뿐이며 별도 MinGW 런타임을 요구하지 않습니다. 아이콘·버전·관리자 권한을 요청하지 않는 manifest를 포함합니다.
- Wine 10의 격리된 테스트 프로필에서 **배포할 실제 EXE**를 실행했습니다. 기본 Edge/Chrome, 명시적 Edge/Chrome, Edge가 없는 경우의 Chrome 대체 5건 통과. 한글·공백 및 따옴표가 있는 레지스트리 설치 경로에서 테스트 브라우저 프로세스로 정확한 게임 URL과 앱 창 옵션이 전달되는지 검사했습니다. 실제 Edge·Chrome Windows 화면 테스트는 아닙니다.
- Chromium에서 1440×900·390×844 다운로드 페이지의 가로 넘침 없음, ZIP 다운로드 이벤트 및 원본 해시 일치를 확인했습니다. 공개 `school.html?desktop=1`의 게임 엔진·캔버스 로드와 JavaScript 예외 없음도 확인했습니다.
- 실제 Windows 10/11 하드웨어의 앱 창·작업 표시줄·SmartScreen, Google 계정 로그인 완료는 이 환경에서 검증하지 못했습니다.

Wine가 준비된 독립 테스트 폴더에서 실행할 수 있습니다. 시스템 Windows 레지스트리가 아닌 `/tmp/school-wine-*` 테스트 폴더만 허용합니다.

```sh
python3 desktop/windows/tests/launch.py --wine /path/to/wine64 --prefix /tmp/school-wine-test --cc /path/to/x86_64-w64-mingw32-gcc
```
