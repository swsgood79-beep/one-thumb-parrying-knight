import json,re,os
d=json.load(open(os.path.join(os.path.dirname(__file__),'patterns.json')));cats=d.pop('__cats')
KIND={'slimeB':'파란 슬라임','slimeP':'분홍 슬라임','slime':'초록 슬라임','goblinS':'고블린 졸개','goblin':'고블린 척후병','batS':'동굴 박쥐','skelS':'뼈다귀 졸개','skeleton':'해골 검사',
 'bogS':'늪 도깨비','orcS':'오크 졸개','orc':'오크 광전사','armorS':'녹슨 갑옷','armor':'저주 갑옷 기사','guardS':'마왕성 경비병','imp':'임프','dknight':'흑기사 친위대'}
STAGE=['초원','초원 끝자락','해골 동굴 입구','박쥐 동굴','해골 왕좌','저주받은 늪','안개 늪','마녀의 오두막','마왕성 성문','마왕의 방']
out=[]
for k,v in d.items():
    if not v['info']:continue
    boss=sorted({int(re.match(r'S(\d+)',w).group(1)) for w in v['where'] if '보스' in w and '2페이즈' not in w})
    p2=sorted({int(re.match(r'S(\d+)',w).group(1)) for w in v['where'] if '2페이즈' in w})
    mins=sorted({int(re.match(r'S(\d+)',w).group(1)) for w in v['where'] if w.endswith('졸개') and w.startswith('S')})
    kinds=[KIND.get(w.split(':')[1],w.split(':')[1]) for w in v['where'] if w.startswith('졸개:')]
    out.append(dict(id=k,name=v['info'][0],cat=v['info'][1],desc=v['info'][2],notes=v['notes'],off=v['off'],boss=boss,p2=p2,mins=mins,kinds=kinds,rand=k in('chaos','chaosS')))
stages=[]
for i in range(10):
    b=[x['name'] for x in out if i+1 in x['boss']];p=[x['name'] for x in out if i+1 in x['p2']];m=[x['name'] for x in out if i+1 in x['mins']]
    stages.append(dict(n=i+1,name=STAGE[i],boss=b,p2=p,mins=m))
data=json.dumps(dict(pats=out,cats=cats,stages=stages),ensure_ascii=False)
html=r'''<title>원썸 패링 나이트 패턴 도감</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;600&display=swap">
<style>
/* layout: arcade score-sheet — a sticky category rail over a grid of note-chart cards, stage map at the end */
:root{--bg:#0f0b24;--panel:#1a1440;--panel2:#221a52;--line:#2f2770;--fg:#f3eeff;--muted:#a99fd6;--tap:#ffd23f;--dodge:#ff4d5e;--hold:#4bb6ff;--ghost:#c9a6ff;--accent:#ff5bb5;
  --f-display:'Black Han Sans','Apple SD Gothic Neo','Malgun Gothic',sans-serif;--f-body:'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:var(--f-body);line-height:1.55;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:20px 48px}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
.wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
header h1{font-family:var(--f-display);font-weight:400;font-size:clamp(34px,7vw,56px);line-height:1.05;margin:0;text-wrap:balance}
header h1 b{font-weight:400;color:var(--tap)}
header p{margin:6px 0 0;color:var(--muted);max-width:62ch}
.kicker{font-size:12px;letter-spacing:.14em;color:var(--accent);text-transform:uppercase}
.howto{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:18px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.howto h2,.map h2{font-family:var(--f-display);font-weight:400;font-size:22px;margin:0 0 8px}
.legend{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;font-size:14px;margin:0}
.legend dt{display:flex;justify-content:center;width:34px}.legend dd{margin:0;color:var(--muted)}.legend dd b{color:var(--fg);font-weight:600}
.rail{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);padding-block:8px;display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--line)}
.rail button{font:600 13px var(--f-body);color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 12px;cursor:pointer}
.rail button[aria-pressed="true"]{background:var(--tap);color:#1a1200;border-color:var(--tap)}
.rail button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.rail .count{opacity:.7;font-weight:400;margin-left:4px;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 12px 10px;display:flex;flex-direction:column;gap:8px;min-width:0}
.card h3{margin:0;font-family:var(--f-display);font-weight:400;font-size:20px;display:flex;gap:8px;align-items:baseline;justify-content:space-between}
.card h3 small{font:600 11px var(--f-body);color:var(--muted);letter-spacing:.06em}
.chart{background:#0b0820;border-radius:8px;padding:6px 4px 2px;overflow-x:auto}
.chart svg{display:block;height:56px;width:auto;max-width:none}
#example svg{height:78px}
.card p{margin:0;font-size:14px}
.meta{display:flex;flex-wrap:wrap;gap:4px;font-size:12px;color:var(--muted)}
.meta span{background:var(--panel2);border-radius:6px;padding:1px 7px}
.meta .b{color:#ffd0a0}.meta .p2{color:#ff9bb5}.meta .m{color:#9fe0ff}
.stats{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.map{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.mapt{overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:640px;font-size:13px}
th,td{text-align:left;vertical-align:top;padding:8px;border-top:1px solid var(--line)}
th{color:var(--muted);font-weight:600;font-size:12px;letter-spacing:.06em}
td.st{white-space:nowrap;font-family:var(--f-display);font-size:16px}td.st small{display:block;font:12px var(--f-body);color:var(--muted)}
@media (max-width:720px){.howto{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<div class="wrap">
<header><div class="kicker">원썸 패링 나이트 · 리듬 패링</div><h1>패턴 도감 <b id="total"></b></h1>
<p>적의 모든 공격 패턴을 악보처럼 그렸어요. 공격은 전부 음악 박자에 떨어지니, 세로줄(박)을 세면서 노트가 판정 원에 닿는 순간 입력하면 돼요.</p></header>
<section class="howto"><div><h2>읽는 법</h2><div class="chart" id="example"></div><p style="font-size:13px;color:var(--muted);margin:6px 0 0">예시: 갤럽 (따다닥 ×3). 숫자는 박 번호, 굵은 줄은 마디의 첫 박이에요.</p></div>
<dl class="legend">
<dt><svg width="18" height="18" viewBox="0 0 18 18"><rect x="4" y="4" width="10" height="10" transform="rotate(45 9 9)" fill="#ffd23f" stroke="#fff3a0"/></svg></dt><dd><b>탭</b> · 노트가 닿는 박에 패링</dd>
<dt><svg width="24" height="18" viewBox="0 0 24 18"><path d="M5 9 l5 -6 v4 h4 v-4 l5 6 l-5 6 v-4 h-4 v4z" fill="#ff4d5e" stroke="#ffd0d6" stroke-width=".8"/></svg></dt><dd><b>회피</b> · 막을 수 없는 붉은 공격, 좌우 스와이프</dd>
<dt><svg width="30" height="18" viewBox="0 0 30 18"><rect x="2" y="4" width="26" height="10" rx="5" fill="#4bb6ff" stroke="#bfe6ff"/></svg></dt><dd><b>꾹</b> · 막대가 끝날 때까지 누르고 버티기</dd>
<dt><svg width="18" height="18" viewBox="0 0 18 18"><rect x="4" y="4" width="10" height="10" transform="rotate(45 9 9)" fill="none" stroke="#c9a6ff" stroke-dasharray="2 2" stroke-width="1.5"/></svg></dt><dd><b>숨은 노트</b> · 직전까지 레인에 안 보여요. 음악으로 맞추기</dd>
<dt style="font:600 12px var(--f-body);color:var(--accent)">0.5박</dt><dd>한 박을 나눈 간격. 0.5 = 8분음표, 0.25 = 16분음표, 0.33 = 셋잇단</dd>
</dl></section>
<nav class="rail" id="rail" aria-label="패턴 분류"></nav>
<section class="grid" id="grid" aria-live="polite"></section>
<section class="map"><h2>스테이지 지도</h2><p style="margin:0 0 8px;color:var(--muted);font-size:14px">스테이지마다 보스(1페이즈 · 각성한 2페이즈)와 졸개가 쓰는 패턴이에요. 뒤로 갈수록 빠르고 복잡해져요.</p><div class="mapt"><table id="map"><thead><tr><th>스테이지</th><th>보스 1페이즈</th><th>보스 2페이즈</th><th>졸개 추가 패턴</th></tr></thead><tbody></tbody></table></div></section>
</div>
<script>
const DATA=__DATA__;
const CATS=[['all','전체']].concat(DATA.cats);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function chart(p,bw){const ns=p.notes,off=p.off||0,end=Math.max(1,...ns.map(n=>n.o+(n.len||0)))+off,beats=Math.ceil(end)+1;bw=bw||30;
  const W=Math.round(16+beats*bw),H=52,y=22,x0=12;let g=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(p.name)} 악보"><rect x="0" y="8" width="${W}" height="28" rx="6" fill="#140d2e"/>`;
  for(let b=0;b<beats;b++){const x=x0+b*bw;g+=`<line x1="${x}" y1="10" x2="${x}" y2="34" stroke="${b%4?'#3b3277':'#7a6ed6'}" stroke-width="${b%4?1:2}"/><text x="${x}" y="48" fill="#a99fd6" font-size="10" text-anchor="middle" font-family="IBM Plex Sans KR,sans-serif">${b+1}</text>`;
    if(bw>=30)g+=`<line x1="${x+bw/2}" y1="16" x2="${x+bw/2}" y2="28" stroke="#2a2360" stroke-width="1"/>`}
  for(const n of ns){const x=x0+(n.o+off)*bw;
    if(n.type==='hold')g+=`<rect x="${x-5}" y="${y-6}" width="${Math.max(10,(n.len||1)*bw+10)}" height="12" rx="6" fill="#4bb6ff" stroke="#bfe6ff"/>`;
    else if(n.type==='swipe')g+=`<path d="M${x-8} ${y} l6 -7 v5 h4 v-5 l6 7 l-6 7 v-5 h-4 v5z" fill="#ff4d5e" stroke="#ffd0d6" stroke-width=".8"/>`;
    else g+=`<rect x="${x-6}" y="${y-6}" width="12" height="12" transform="rotate(45 ${x} ${y})" fill="${n.ghost?'none':'#ffd23f'}" stroke="${n.ghost?'#c9a6ff':'#fff3a0'}" ${n.ghost?'stroke-dasharray="2 2" stroke-width="1.6"':''}/>`}
  return g+'</svg>'}
const rng=a=>a.length?(a.length>3&&a[a.length-1]-a[0]===a.length-1?`S${a[0]}~S${a[a.length-1]}`:a.map(n=>'S'+n).join(' ')):'';
function card(p){const t=p.notes.filter(n=>n.type==='tap').length,s=p.notes.filter(n=>n.type==='swipe').length,h=p.notes.filter(n=>n.type==='hold').length,g=p.notes.filter(n=>n.ghost).length;
  const len=Math.max(...p.notes.map(n=>n.o+(n.len||0)))+(p.off||0);const cat=(DATA.cats.find(c=>c[0]===p.cat)||[,''])[1];
  const where=[p.boss.length?`<span class="b">보스 ${rng(p.boss)}</span>`:'',p.p2.length?`<span class="p2">2페이즈 ${rng(p.p2)}</span>`:'',p.mins.length?`<span class="m">졸개 ${rng(p.mins)}</span>`:'',...p.kinds.map(k=>`<span class="m">${esc(k)}</span>`)].filter(Boolean).join('');
  return `<article class="card"><h3>${esc(p.name)}<small>${esc(cat)}</small></h3><div class="chart">${chart(p)}</div><p>${esc(p.desc)}${p.rand?' <span style="color:var(--ghost)">(매번 달라져요 · 예시)</span>':''}</p>
    <div class="stats">노트 ${p.notes.length} · 탭 ${t}${s?` · 회피 ${s}`:''}${h?` · 꾹 ${h}`:''}${g?` · 숨김 ${g}`:''} · 길이 ${Math.round(len*100)/100}박${p.off?' · 엇박 시작':''}</div>${where?`<div class="meta">${where}</div>`:''}</article>`}
let cur='all';try{cur=localStorage.getItem('pb-cat')||'all'}catch(e){}
function render(){
  document.getElementById('rail').innerHTML=CATS.map(([k,l])=>{const n=k==='all'?DATA.pats.length:DATA.pats.filter(p=>p.cat===k).length;return `<button type="button" data-k="${k}" aria-pressed="${k===cur}">${l}<span class="count">${n}</span></button>`}).join('');
  document.getElementById('grid').innerHTML=DATA.pats.filter(p=>cur==='all'||p.cat===cur).map(card).join('');}
document.getElementById('rail').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;cur=b.dataset.k;try{localStorage.setItem('pb-cat',cur)}catch(_){}render()});
document.getElementById('total').textContent=DATA.pats.length+'종';
document.getElementById('example').innerHTML=chart(DATA.pats.find(p=>p.id==='gallop'),44);
document.querySelector('#map tbody').innerHTML=DATA.stages.map(s=>`<tr><td class="st">S${s.n}<small>${esc(s.name)}</small></td><td>${s.boss.map(esc).join(', ')}</td><td>${s.p2.map(esc).join(', ')}</td><td>${s.mins.map(esc).join(', ')||'—'}</td></tr>`).join('');
render();
</script>'''
open(os.path.join(os.path.dirname(__file__),'../../docs/pattern-book.html'),'w',encoding='utf8').write(html.replace('__DATA__',data))
print('ok',len(out))
