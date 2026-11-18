# 모험 지역 카드 일러스트

2026-11-18 사용자가 제시한 세로 지역 카드 UI를 위한 학교용병단 전용 정적 풍경입니다. 참조는 `/tmp/codex-remote-attachments/6afb8749-0630-8191-8034-5fe6a73600ae/09e80a5e-21c0-4f2c-971f-386f488e553e/1-14521.jpg`이며, 그림형 지역 선택의 구성만 참고했습니다. 원본 게임의 지역·등장인물·UI·명칭을 복제하지 않았습니다.

`image_gen`으로 학교용병단의 기존 `SchoolRPG.CHAPTERS` 12개 구역에 맞는 인물 없는 도트 판타지 디오라마를 제작했습니다. 글자·버튼·잠금·클리어 진행도는 이미지에 포함하지 않고 실제 UI가 표시합니다.

| 파일 | 구역 |
| --- | --- |
| `region-01.webp` | 오래된 교실 |
| `region-02.webp` | 방과 후 복도 |
| `region-03.webp` | 비밀의 도서관 |
| `region-04.webp` | 뒤뜰의 정원 |
| `region-05.webp` | 체육관 결계 |
| `region-06.webp` | 별이 내리는 옥상 |
| `region-07.webp` | 눈 내린 운동장 |
| `region-08.webp` | 잊혀진 별관 |
| `region-09.webp` | 마력 실험실 |
| `region-10.webp` | 지하 통로 |
| `region-11.webp` | 학교의 경계 |
| `region-12.webp` | 바람의 성소 |

## 생성과 패키징

원본은 3열×2행 시트 2장으로, 각각 1254×1254입니다.

- 01~06: `/workspace/generated_images/exec-0006d63c-1e5f-457b-bc6f-300390262584.png`
- 07~12: `/workspace/generated_images/exec-adf664ff-5207-4bcb-ba36-1eb9d8e45a1e.png`

원본에서 왼쪽 위부터 행 우선 순서로 418×627 셀을 분리했습니다. 시트 경계선 1px을 각 변에서 잘라낸 후 nearest-neighbor로 384×576에 맞췄으며, WebP quality 95 / method 6으로 저장했습니다. 생성 이후 새 그림을 덧그리지 않았습니다. 파일별 소스·셀·크롭 좌표·이름·바이트 수는 `assets.json`에 기록했습니다.

12개 모두 RGB 384×576(2:3)이고 총 크기는 **1,261,914 bytes**입니다. 배포 버전 쿼리는 `?v=adventure1`입니다. 모든 그림은 정적이며 런타임 이미지 생성이나 큰 영상·애니메이션 디코딩을 사용하지 않습니다. 화면 밖 카드는 `loading="lazy" decoding="async"`로 불러오는 것을 권장합니다.

## 확인

이미지 개수·치수·RGB 형식·파일 바이트와 메타데이터의 일치를 검증했습니다. Chromium의 실제 이미지 요소에서 12장 모두 성공적으로 디코딩한 뒤 `/tmp/adventure-regions-contactsheet.png`를 캡처해 구역 순서와 잘림을 확인했습니다. 해당 미리보기의 이름표는 검토용 HTML이고 배포 이미지에는 없습니다.
