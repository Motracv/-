# 학교 안뜰 로비 자산

2026-11-18 사용자가 승인한 로비 시안 `exec-321f8382-bdca-4b8d-add4-428fd70f0a32.png`를 기준으로 만든 정적 게임 자산입니다. 인게임 캐릭터·텍스트·버튼 판정은 그림에 포함하지 않으며 기존 캐릭터 아트와 HTML이 별도로 표시합니다.

## 배경

- `courtyard.webp`: 1821×864, 410,888 bytes. 분수 중심은 화면의 약 51% / 53%입니다.
- 생성 원본: `/workspace/generated_images/exec-0fbf40e5-5bc5-4abb-9871-837982dd67b3.png`.
- `image_gen` 편집으로 승인 시안의 HUD·아이콘·글자·별·캐릭터와 그 그림자를 제거하고 바닥을 복원했습니다. 학교·등불·나무·벤치·분수의 장면을 유지했습니다.
- 원본 크기 그대로 WebP quality 95 / method 6으로 패키징했습니다. 런타임은 한 장의 정적 배경으로 표시하며 배경을 매 프레임 다시 생성하지 않습니다.

## 아이콘

아이콘 원본은 `image_gen`으로 생성한 5열×2행 투명 시트 `/workspace/generated_images/exec-cce2ab91-b304-4c57-aba7-6e36c4100452.png`입니다. 원본 크기는 1983×793입니다. 각 셀에서 alpha 4 이상 영역과 3px 여백을 기준으로 크롭하고, 원래 RGBA를 유지하여 가장 긴 변 224px에 nearest-neighbor로 맞춘 뒤 256×256 투명 캔버스에 가운데 정렬했습니다. 생성 뒤 임의의 새 픽셀을 그리거나 모양을 바꾸지 않았습니다. WebP는 lossless입니다.

| 파일 | 그림 | 기본 기능 |
| --- | --- | --- |
| `icon-recruit.webp` | 푸른 소환 구슬 | 모집 |
| `icon-supplies.webp` | 금장 나무 상자 | 보급 |
| `icon-codex.webp` | 펼친 도감 | 도감 |
| `icon-arena.webp` | 교차한 검 | 아레나 |
| `icon-dungeon.webp` | 보라색 지하 문 | 던전 |
| `icon-adventure.webp` | 초록 학교 정문 | 모험 |
| `icon-quests.webp` | 양피지 두루마리 | 임무 |
| `icon-ranking.webp` | 금빛 트로피 | 랭킹 |
| `icon-winter.webp` | 눈꽃 선물 상자 | 겨울 이벤트 |
| `icon-help.webp` | 물음표 안내서 | 도움말 |

모두 256×256이며 총 514,164 bytes입니다. 소스 셀·크롭 영역·배치 영역·바이트 수는 `assets.json`에 기록했습니다. 아이콘 전체의 디코딩 픽셀은 655,360개(약 2.5MiB RGBA)입니다. 실제 표시 크기는 CSS에서 조절합니다.

## 확인

Chromium의 진한 남색 바탕에서 아이콘 10개를 실제 이미지 요소로 표시해 투명 배경·잘림·가독성을 확인했습니다(`/tmp/lobby-icons-preview.png`). 원본 이미지 외곽에 존재하는 거의 투명한 픽셀 때문에 일부 로컬 이미지 뷰어가 보이는 RGB 영역은 실제 브라우저의 알파 합성에서 나타나지 않습니다. 게임 폴더에는 원본 대형 PNG 시트를 중복 배포하지 않습니다.
