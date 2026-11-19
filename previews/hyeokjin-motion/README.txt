서혁진 모션·스킬 시안 · 기본 모션은 이펙트 없음 / 스킬은 이펙트 포함

normal.png / awakened.png: 투명 RGBA 스프라이트 시트, 각 16프레임.
skills-a.png: 흡혈 4프레임 / 폼 체인지 4프레임 / 블랙 8프레임.
skills-b.png: 참수 8프레임 / 궁극기 8프레임.
animation.json: 원본 시트의 프레임 사각형, 발 기준점(pivot), 클립별 프레임 순서와 지속시간(ms).
idle.gif / walk.gif / attack.gif: 기본형과 각성형을 나란히 재생하는 미리보기.
recovery.gif / transform.gif / black.gif / execution.gif / ultimate.gif: 스킬별 GIF.
index.html: 기본 모션·스킬 선택, 일시정지, 재생속도 변경.

웹 미리보기: https://motracv.github.io/-/previews/hyeokjin-motion/
로컬 HTML은 파일을 직접 열기보다 정적 HTTP 서버에서 확인해 주세요.

적용 방법:
1. JSON forms.normal 또는 forms.awakened와 해당 image를 읽습니다.
2. animations의 durations를 누적해 현재 frames 인덱스를 선택합니다.
3. frames[n]의 x,y,w,h 사각형을 원본 PNG에서 읽습니다.
4. 캐릭터의 월드 좌표를 발 위치로 잡고, pivot을 빼서 그립니다.
   drawImage(image, x,y,w,h, worldX-pivot.x,worldY-pivot.y,w,h)
5. 배율이 필요하면 목적 사각형과 pivot에 같은 배율을 곱합니다.
6. imageSmoothingEnabled=false로 설정합니다.
7. 공격 시퀀스의 hitIndex=4는 연출상의 명중 기준이며 전투 엔진 판정은 별도입니다.

프레임은 4열×4행입니다. 1254px 원본은 4로 나누어떨어지지 않으므로 JSON의 좌표를 사용하세요.
원본 투명도와 픽셀을 보존하고, 재생 시에만 발 기준점을 적용합니다.
기본형 평타 루프 1800ms / 각성형 1400ms. 마지막 대기 프레임은 다음 공격 전 회복 구간입니다.
현재는 검토용 모션 시안이며 실제 캐릭터 출시와 스킬 판정은 적용하지 않았습니다.

스킬 JSON 사용 방법:
- skills[스킬ID]의 sheet 이름으로 sheets[이름]을 찾습니다.
- 스킬의 frames와 durations에 따라 sheets의 프레임을 순서대로 재생합니다.
- 스킬 원화는 효과 여백을 확보해 작게 그렸으므로 기본 모션과 연결할 때 sheets.renderScale=1.4를 동일하게 적용합니다.
- GIF와 웹의 스킬 확대 시안은 자세를 보기 쉽게 1.65배 표시합니다.
- 스킬 pivot은 그림 전체 경계가 아닌 발이 닿는 바닥 기준입니다. 도약 중 발 높이는 그대로 유지됩니다.
- 스킬 그림은 캐릭터와 이펙트가 합쳐진 투명 프레임입니다. 별도 이펙트 레이어는 포함하지 않습니다.
- 회복 1.64초 / 변신 1.86초 / 블랙 1.57초 / 참수 1.70초 / 궁극기 2.63초.
- loop:true는 시안 반복 재생용입니다. 실제 스킬 시전은 1회 재생 후 전투 엔진의 상태로 복귀시킵니다.
- hitIndex는 클립 내 위치이며 엔진의 실제 피해·회복·불사 판정은 별도입니다.
- GIF는 25fps(40ms)로 양자화되므로 정확한 타이밍은 JSON durations를 사용하세요.
