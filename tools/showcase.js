// Builds one captioned image from game screenshots so each update can be shown at a glance.
// Usage: node tools/showcase.js out.png "제목" img1.png "설명1" img2.png "설명2" ...
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [out, title, ...rest] = process.argv.slice(2);
const items = [];
for (let i = 0; i < rest.length; i += 2) items.push({ src: 'data:image/png;base64,' + fs.readFileSync(rest[i]).toString('base64'), cap: rest[i + 1] || '' });
const cols = Math.min(4, items.length);
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Jua&display=swap">
<style>body{margin:0;background:#140f2c;color:#f5f0ff;font-family:Jua,'Noto Sans CJK KR',sans-serif;padding:28px}
h1{font-family:'Black Han Sans',Jua,sans-serif;font-weight:normal;color:#ffc83a;font-size:40px;margin:0 0 20px}
.g{display:grid;grid-template-columns:repeat(${cols},300px);gap:20px}
figure{margin:0;background:#1f1844;border:3px solid #3b3277;border-radius:18px;padding:10px}
img{width:100%;border-radius:10px;display:block}
figcaption{font-size:17px;line-height:1.4;margin-top:10px;min-height:48px}
b{color:#ffc83a;font-weight:normal;margin-right:6px}</style>
<h1>${title}</h1><div class="g">${items.map((it, i) => `<figure><img src="${it.src}"><figcaption><b>${i + 1}</b>${it.cap}</figcaption></figure>`).join('')}</div>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: cols * 320 + 36, height: 600 } });
  await p.setContent(html); await p.waitForTimeout(800);
  await p.screenshot({ path: out, fullPage: true }); await b.close(); console.log('saved', out);
})();
