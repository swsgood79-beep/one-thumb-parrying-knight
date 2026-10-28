const { chromium } = require('playwright');const fs=require('fs');
const src=fs.readFileSync(require('path').resolve(__dirname,'../../tests/game-test.js'),'utf8');
const CLOCK=eval(src.match(/const CLOCK = (`[\s\S]*?`);/)[1]);
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.addInitScript(CLOCK);
 await p.goto('file://'+require('path').resolve(__dirname,'../../index.html'));
 const d=await p.evaluate(()=>{const out={};Math.random=(()=>{let s=3;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646}})();
  for(const k in PATMAKE){const P=PATMAKE[k]();out[k]={kind:P.kind,lead:P.lead||1,off:P.off||0,notes:P.notes.map(n=>({o:n.o,type:n.type,len:n.len||0,ghost:!!n.ghost})),where:[]}}
  POOLS.forEach((pl,i)=>{for(const[n]of pl.base)out[n]&&out[n].where.push(`S${i+1} 보스`);for(const[n]of(pl.p2||[]))out[n]&&out[n].where.push(`S${i+1} 보스 2페이즈`)});
  for(const kind in MINION_POOLS)for(const[n]of MINION_POOLS[kind])out[n]&&out[n].where.push(`졸개:${kind}`);
  MINION_EXTRA.forEach((l,i)=>{for(const[n]of l)out[n]&&out[n].where.push(`S${i+1} 졸개`)});
  for(const k in out){out[k].info=PAT_INFO[k]||null}out.__cats=PAT_CATS;return out});
 fs.writeFileSync(require('path').resolve(__dirname,'patterns.json'),JSON.stringify(d,null,0));console.log(Object.keys(d).length,Object.keys(d).join(' '));await b.close()})();
