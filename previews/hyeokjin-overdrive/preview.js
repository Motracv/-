'use strict';
const video=document.getElementById('video'),gif=document.getElementById('gif'),toggle=document.getElementById('toggle'),status=document.getElementById('loading'),current=document.getElementById('current'),detail=document.getElementById('detail');
const buttons=[...document.querySelectorAll('[data-mode]')];let clips=[],selected='all',segment=null,seekTo=null;
const description={basic:'힘을 모아 내려베는 물리 평타',transform:'8초 각성 · 불사와 흡혈 활성화',black:'전방 최대 3명에게 어둠의 참격',execution:'단일 강타 · 체력이 낮은 적에게 피해 증가',recovery:'명중 후 자신의 체력 회복',ultimate:'전투당 1회 · 축적한 실제 피해 해방',last:'마지막 생존자 · 5초 피해 면역'};
function play(){video.play().catch(()=>{toggle.textContent='재생';status.textContent='재생 버튼을 눌러 애니메이션을 시작하세요.';});}
function jump(t){if(video.readyState>=1){video.currentTime=t;seekTo=null;}else seekTo=t;}
function update(){toggle.textContent=video.paused?'재생':'일시정지';if(selected!=='all')return;const live=clips.filter(c=>c.start<=video.currentTime&&video.currentTime<c.start+c.duration).at(-1);current.textContent=live?.name||'전체 모션';detail.textContent=live?description[live.mode]||'':'평타 · 각성 · 스킬 · 궁극기 · 책임감';}
function select(mode){if(mode!=='all'&&!clips.length){status.textContent='스킬 구간을 불러오고 있어요. 잠시 후 다시 눌러 주세요.';return;}selected=mode;gif.hidden=true;video.hidden=false;document.querySelector('.controls').hidden=false;document.getElementById('fallback').textContent='궁극기 GIF로 보기';segment=mode==='all'?null:clips.find(c=>c.mode===mode);if(mode!=='all'&&!segment){status.textContent='구간을 불러오는 중이에요. 아래 전체 영상이나 GIF로 확인할 수 있어요.';return;}buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));current.textContent=segment?.name||'전체 모션';detail.textContent=description[mode]||'평타 · 각성 · 스킬 · 궁극기 · 책임감';status.textContent=segment?'선택한 동작을 반복 재생하고 있어요.':'전체 시연을 재생하고 있어요.';jump(segment?.start||0);play();}
buttons.forEach(b=>b.addEventListener('click',()=>select(b.dataset.mode)));
toggle.addEventListener('click',()=>{if(video.hidden){gif.hidden=true;video.hidden=false;document.getElementById('fallback').textContent='궁극기 GIF로 보기';}video.paused?play():video.pause();});
document.getElementById('replay').addEventListener('click',()=>select(selected));
document.getElementById('speed').addEventListener('change',e=>{video.playbackRate=Number(e.target.value);});
video.addEventListener('loadedmetadata',()=>{if(seekTo!==null)jump(seekTo);});
for(const event of ['play','pause','loadeddata'])video.addEventListener(event,update);
video.addEventListener('timeupdate',()=>{if(segment&&!video.seeking&&video.currentTime>=segment.start+segment.duration+.12)jump(segment.start);update();});
video.addEventListener('error',()=>{status.textContent='영상이 열리지 않으면 아래 GIF로 확인하세요.';});
document.getElementById('fallback').addEventListener('click',()=>{const show=gif.hidden;gif.hidden=!show;video.hidden=show;document.querySelector('.controls').hidden=show;if(show){video.pause();current.textContent='내가 지켜온 모든 것 · GIF';detail.textContent='궁극기 연출 반복';}else{current.textContent=segment?.name||'전체 모션';detail.textContent=description[selected]||'';play();}document.getElementById('fallback').textContent=show?'영상으로 돌아가기':'궁극기 GIF로 보기';});
fetch('chapters.json').then(r=>{if(!r.ok)throw Error('metadata');return r.json();}).then(data=>{clips=data;status.textContent='스킬을 선택하거나 전체 영상을 확인하세요.';update();}).catch(()=>{status.textContent='전체 영상은 재생할 수 있어요. 구간 선택은 새로고침 후 다시 시도해 주세요.';});
if(matchMedia('(prefers-reduced-motion: reduce)').matches)video.pause();
