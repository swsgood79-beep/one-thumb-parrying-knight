// Automated play test for 원썸 패링 나이트.
// Runs the game in headless Chromium on a virtual clock (fast-forward), with an in-page bot
// that plays every region's full expedition with human-like mistakes.
// Fails on: uncaught errors, a frozen game loop, a state stuck for too long, or a run that never ends.
// Usage: node tests/game-test.js [--regions 0-9] [--runs 2] [--seed 1]
const { chromium } = require('playwright');
const path = require('path');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [r0, r1] = (opt('regions', '0-9')).split('-').map(Number);
const RUNS = +opt('runs', 2);
const SKILL = +opt('skill', 0.82);
const STATS = args.includes('--stats');
const COLLECTOR = args.includes('--collector');
const FILE = 'file://' + path.resolve(__dirname, '..', opt('file', 'index.html'));

// virtual clock: rAF, timers and performance.now all advance only when __tick() is called
const CLOCK = `(()=>{
  let now=0,id=0;const raf=new Map(),timers=new Map();
  window.__noTips=true;window.__noBossIntro=true;window.__errors=[];addEventListener('error',e=>__errors.push(String(e.message||e.error)));
  const ce=console.error.bind(console);console.error=(...a)=>{__errors.push('console.error: '+a.map(String).join(' '));ce(...a)};
  addEventListener('unhandledrejection',e=>__errors.push('promise: '+e.reason));
  performance.now=()=>now;
  window.requestAnimationFrame=f=>{raf.set(++id,f);return id};window.cancelAnimationFrame=i=>raf.delete(i);
  window.setTimeout=(f,ms=0)=>{timers.set(++id,{f,at:now+ms});return id};window.clearTimeout=i=>timers.delete(i);
  window.setInterval=(f,ms=0)=>{const t={f,at:now+ms,every:Math.max(1,ms)};timers.set(++id,t);return id};window.clearInterval=i=>timers.delete(i);
  window.__tick=(ms)=>{now+=ms;
    for(const[k,t]of[...timers]){if(t.at<=now){if(t.every){t.at+=t.every}else timers.delete(k);try{t.f()}catch(e){__errors.push('timer: '+e.message)}}}
    const fs=[...raf.values()];raf.clear();for(const f of fs){try{f(now)}catch(e){__errors.push('frame: '+e.message+' @ '+(e.stack||'').split('\\n')[1])}}};
  window.__now=()=>now;
})();`;

const BOT = `(()=>{
  const R0=Math.random;let seed=1;Math.random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};window.__seed=s=>{seed=s};
  window.__bot={skill:.82,plan:null,fork:0,log:[]};
  const pickBtn=sel=>{const b=document.querySelector(sel);if(b&&!b.disabled){b.click();return true}return false};
  window.__botStep=()=>{
    const m=document.querySelector('#modal');
    if(!m.hidden){const h=(document.querySelector('#mbox h2')||{}).textContent||'';__bot.log.push(h);
      if(h.startsWith('갈림길'))return pickBtn(__bot.fork++%2?'[data-m="spring"]':'[data-m="danger"]');
      if(h.startsWith('카드'))return pickBtn('[data-m="c0"]');
      if(h.startsWith('원정 성공')){__bot.result='win';return pickBtn('[data-m="take"]')}
      if(h.startsWith('쓰러')){if(!__bot.noRevive&&pickBtn('[data-m="gem"]'))return;__bot.result='lose';return pickBtn('[data-m="quit"]')}
      if(h.startsWith('연승이'))return pickBtn('[data-m="drop"]');
      return pickBtn('#mbox [data-m]')}
    if(typeof B==='undefined'||!B.active||B.paused)return;
    if(B.tutWait){__bot.log.push('tut:'+B.tutStep+':'+B.tutWait);if(B.tutWait==='hold')setGuard(true);else if(B.tutWait==='swipe')onSwipe(-1);else onTap();return}
    if(!__bot.noFever&&typeof fvReady==='function'&&fvReady()&&!B.disarm&&B.state==='IDLE'){feverStart();return}   // players press the FEVER button when it shows
    const t=B.time;
    if(B.state==='GROGGY'||B.grab){onTap();return}
    if(B.state==='OPEN'){if(B.open&&B.open.real)onTap();else if(B.open&&Math.random()<(1-__bot.skill)*.04)onTap();return}
    if(B.state==='EXEC'){if(!B.exec)return;if(B.exec.charge<0){__bot.execAt=Math.random()<__bot.skill?.86:(Math.random()<.5?.6:1.2);onTap()}else if((t-B.exec.charge)/EXEC_MS>=__bot.execAt)onRelease();return}
    if(B.state==='WAKE'&&!B.atk.resolved&&B.atk.impact-t<260){onSwipe(-1);return}
    if(B.state!=='WINDUP'||!B.atk||B.atk.resolved){if(B.guard)setGuard(false);return}
    const a=B.atk,n=a.notes[a.idx],key=a.start+':'+a.idx;
    if(n.type==='hold'){setGuard(t>=n.t-80&&Math.random()<.995);return}
    if(n.type==='block'){if(!__bot.plan||__bot.plan.key!==key)__bot.plan={key,done:true,go:Math.random()<__bot.skill};setGuard(__bot.plan.go&&t>=n.t-420);return}
    if(a.kind==='smash'&&!a.heavy){if(!__bot.sp||__bot.sp.key!==key)__bot.sp={key,go:Math.random()<__bot.skill};if(__bot.sp.go&&t-a.start>a.dur*.3)onSwipeUp();return}
    if(B.guard)setGuard(false);
    if(!__bot.plan||__bot.plan.key!==key){const good=Math.random()<__bot.skill;
      const g=Math.sqrt(-2*Math.log(Math.random()+1e-9))*Math.cos(6.2832*Math.random());
      __bot.plan={key,done:false,at:good?(n.type==='swipe'||n.type==='jump'?140:15+g*(__bot.sig??40)):(Math.random()<.5?350:-160)}}
    if(!__bot.plan.done&&a.impact-t<=__bot.plan.at){__bot.plan.done=true;if(n.type==='swipe')onSwipe(B.disarm?B.disarm.side:n.dir||-1);else if(n.type==='jump')onSwipeUp();else onTap()}
  };
})();`;

(async () => {
  const SCEN_SRC = '';
  const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const fails = []; let total = 0;
  for (let region = r0; region <= r1; region++) for (let run = 0; run < RUNS; run++) {
    total++;
    const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
    page.on('pageerror', e => fails.push(`[지역${region + 1} #${run}] pageerror: ${e.message}`));
    await page.addInitScript(CLOCK);
    const stage = Math.round(region * 11), shSt = [0, 5, 20, 40, 60, 80, 95].filter(r => r <= stage).length - 1, shMax = [10, 20, 30, 45, 60, 80, 100][shSt];
    await page.addInitScript(`localStorage.setItem('otpk-save-v1',JSON.stringify({intro:true,prologue:true,login:'guest',snd:true,bgm:true,vib:true,cleared:${stage},sel:${stage},
      shStage:${shSt},shLv:${Math.min(shMax, 4 + Math.round(stage * .95))},exp:${Math.round(30 * stage + 2 * stage * stage)},gems:999,energy:30,
      engr:['slime','goblin','bat','skull'],engrEq:['bat']${COLLECTOR?`,eng:${JSON.stringify(Object.fromEntries(['oak','copper','pebble','leaf','feather','clay','ember','dew','owl','honey','moon','tide','rock','phoenix','storm'].map((k,i)=>[k,{star:1+(i%3),shards:0}])))},engrEq:['phoenix','tide','honey']`:''}}))`);
    await page.goto(FILE);
    await page.addScriptTag({ content: BOT });
    const res = await page.evaluate(({ region, run, SKILL_, STATS_ }) => {
      window.__noBossIntro = false; __seed(region * 100 + run + 7); __bot.skill = SKILL_; __bot.noRevive = STATS_; let minHp = 1;
      for (let i = 0; i < 120; i++) __tick(16);                    // opening plays
      document.querySelector('#sSkip').click(); __tick(16);
      document.querySelector('#tStart').click(); for (let i = 0; i < 30; i++) __tick(16);
      const hm = document.querySelector('#mbox [data-m]'); if (hm) hm.click();
      document.querySelector('#startBtn').click();
      let lastT = -1, stillMs = 0, stateMs = 0, lastState = '', vt = 0, problem = null, winV = 0, winG = 0, winT0 = null;
      const LIMIT = 25 * 60 * 1000;                                  // 15 virtual minutes per run
      while (vt < LIMIT && !__bot.result) {
        __tick(16); vt += 16; __botStep(); if (typeof B !== 'undefined' && B.active && B.pmax && !(R && R.prologue)) minHp = Math.min(minHp, B.php / B.pmax);
        if (__errors.length) { problem = 'error: ' + __errors[0]; break; }
        const modalOpen = !document.querySelector('#modal').hidden;
        if (typeof B !== 'undefined' && B.active && !B.paused && !modalOpen) {
          if (B.time === lastT && B.hitstop <= 0) stillMs += 16; else stillMs = 0;
          lastT = B.time;
          if (stillMs > 3000) { problem = `frozen: game clock stopped in state ${B.state}`; break; }
          // the game clock must keep up with real time (hitstop / slow-motion may only take a small share)
          if (winT0 === null || B.time < winT0) { winT0 = B.time; winV = 0; } winV += 16;
          if (winV >= 2000) { const ratio = (B.time - winT0) / winV;
            if (ratio < 0.4) { problem = `clock starved: game time ran at ${Math.round(ratio * 100)}% of real time in state ${B.state}`; break; }
            winV = 0; winT0 = B.time; }
          if (B.state === lastState) stateMs += 16; else { stateMs = 0; lastState = B.state; }
          const cap = { IDLE: 6000, INTRO: 6000, WINDUP: 12000, STRIKE: 3000, RECOIL: 3000, GROGGY: 9000, WAKE: 4000, WALK: 3000, VICTORY: 6000, DEFEAT: 6000, TRANSFORM: 12000 }[B.state] || 8000;
          if (stateMs > cap) { problem = `stuck: state ${B.state} for ${stateMs}ms (room ${R && R.room}, pattern ${B.atk && B.atk.name})`; break; }
        } else { stillMs = 0; stateMs = 0; winV = 0; winT0 = null; }
      }
      if (!problem && !__bot.result) problem = 'run did not finish in 15 virtual minutes';
      if (!problem && !__bot.result) problem = 'run did not finish in 15 virtual minutes';
      return { problem, result: __bot.result, room: typeof R !== 'undefined' && R ? R.room : 'done', vt, gold: S.gold, minHp };
    }, { region, run, SKILL_: SKILL, STATS_: STATS });
    const tag = `[스테이지${stage + 1} #${run}]`;
    if (res.problem) fails.push(`${tag} ${res.problem}`);
    console.log(`${tag} ${res.problem ? 'FAIL' : 'ok'} result=${res.result} virtual=${Math.round(res.vt / 1000)}s minHP=${Math.round(res.minHp * 100)}% ${res.problem || ''}`);
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
    page.on('pageerror', e => fails.push(`[시나리오] pageerror: ${e.message}`));
    await page.addInitScript(CLOCK);
    await page.addInitScript(`localStorage.setItem('otpk-save-v1',JSON.stringify({intro:true,prologue:true,login:'guest',snd:false,bgm:false,cleared:9,shStage:0,shLv:1}))`);
    await page.goto(FILE);
    await page.addScriptTag({ content: BOT });
    const res = await page.evaluate(() => {
      __bot.skill = 1;
      for (let i = 0; i < 60; i++) __tick(16); document.querySelector('#sSkip').click(); __tick(16);
      document.querySelector('#tStart').click(); for (let i = 0; i < 30; i++) __tick(16);
      const hm = document.querySelector('#mbox [data-m]'); if (hm) hm.click();

  // ---- focused scenarios (bugs found by players get a scenario here so they never come back) ----
  const scenarios = [
    { name: '기절한 보스 연타 시 시계 멈춤 (해골 대장)', run: () => {
      startRun(4); R.room = 4; startFight(roomCfg(4, 'boss'), false);
      for (let i = 0; i < 200; i++) __tick(16);
      B.ehp = B.emax = 1e7; B.stun = 100; enterGroggy();
      const t0 = B.time; let vt = 0;
      while (B.state === 'GROGGY' && vt < 15000) { __tick(16); vt += 16; onTap(); if (__errors.length) return 'error: ' + __errors[0]; }
      const ratio = (B.time - t0) / vt;
      if (B.state === 'GROGGY') return `groggy never ended while mashing (game clock ran at ${Math.round(ratio * 100)}%)`;
      if (ratio < 0.5) return `game clock starved while mashing: ${Math.round(ratio * 100)}%`;
      return null; } },
    { name: '리듬 챌린지 끝까지', run: () => {
      startRhythm(); let vt = 0;
      while (vt < 90000) { __tick(16); vt += 16; __botStep && (document.querySelector('#modal').hidden ? __botStep() : 0);
        if (__errors.length) return 'error: ' + __errors[0];
        const h = (document.querySelector('#mbox h2') || {}).textContent || '';
        if (!document.querySelector('#modal').hidden && h.startsWith('리듬 챌린지 결과')) { const sc = +document.querySelector('#mbox p b').textContent.replace(/,/g, ''); document.querySelector('[data-m="home"]').click(); return sc > 0 ? null : 'score was 0'; } }
      return 'rhythm never finished'; } },
    { name: '미션 · 주간 상자 · 패스 · 외형 · 오프라인 보상', run: () => {
      const D = dm(); D.ids.forEach(id => track(MISS[id].evt, 999));
      if (!missionsClaimable()) return 'missions not claimable after progress';
      missionsModal(); D.ids.forEach(id => { const b = document.querySelector(`[data-m="m_${id}"]`); if (!b || b.disabled) throw new Error('mission button ' + id); b.click(); });
      if (wk().pts !== 60) return 'weekly points ' + wk().pts;
      document.querySelector('[data-m="w0"]').click(); closeModal();
      addPassXP(5000); if (passLevel() !== 20) return 'pass level ' + passLevel();
      passModal(); document.querySelector('[data-m="buy"]').click(); document.querySelector('[data-m="p1"]').click(); closeModal();
      if (!S.skins.includes('flame')) return 'pass skin not granted';
      equipSub = 'look'; setTab('equip'); const sb = document.querySelector('[data-act="setSkin"][data-id="flame"]'); if (!sb) return 'skin button missing'; sb.click();
      if (S.skin !== 'flame') return 'skin not equipped';
      S.lastSeen = Date.now() - 3 * 3600e3; offlineCheck();
      if (((document.querySelector('#mbox h2') || {}).textContent || '') !== '쉬는 동안') return 'offline reward modal missing';
      closeModal(); setTab('battle');
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '각인 유물: 상자 · 별 강화 · 수집 보너스 · 효과', run: () => {
      S.gems = 99999; S.gold = 999999; const hp0 = hpMax();
      for (let i = 0; i < 6; i++) { openBox(10); if (document.querySelector('#gacha').hidden) return 'box opening show did not start'; gSkip(); if (document.querySelectorAll('#gCards .gcard.flip').length !== 10) return 'skip did not reveal all 10 cards'; gClose(); closeModal(); }
      if (ownedCount() < 15) return 'too few engravings after 60 draws: ' + ownedCount();
      const rar = new Set(Object.keys(S.eng).map(id => ENGR[id].r)); if (!rar.has(0) || !rar.has(1) || !rar.has(2)) return 'rarity spread missing';
      if (ENGRAVINGS.some(e => e.boss && S.eng[e.id] && S.cleared <= e.from)) return 'boss engraving came out of a box';
      const id = Object.keys(S.eng).find(k => !ENGR[k].boss); S.eng[id].shards = 99; const st0 = starOf(id); starUp(id); if (starOf(id) !== st0 + 1) return 'star up failed';
      if (collectBonus().pts <= 0 || hpMax() <= hp0) return 'collection bonus not applied';
      gainE('eternal'); S.engrEq = ['eternal']; const hpE = hpMax(); S.engrEq = []; if (hpE - hpMax() < 40) return 'eternal hp effect missing';
      S.engrEq = ['sun']; gainE('sun'); const f = EFX(); if (!f.perfectChip || !f.perfectHealPct) return 'EFX missing sun effects';
      boxOdds(); const rows = document.querySelectorAll('#mbox .odds tr').length; closeModal(); if (rows !== 6) return 'odds table rows ' + rows;
      equipSub = 'engr'; setTab('equip'); if (!document.querySelector('.cbonus')) return 'collection bonus box missing'; document.querySelector('[data-act="engrInfo"]').click();
      if (!document.querySelector('#mbox .rbadge')) return 'engraving detail missing'; closeModal(); setTab('battle');
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '황금 고블린 금고: 입장 · 금화 · 결과 · 소탕 · 입장권', run: () => {
      const vrun = skill => { __bot.skill = skill; let vt = 0;
        while (vt < 120000) { __tick(16); vt += 16; if (__errors.length) return 'error: ' + __errors[0];
          const h = (document.querySelector('#mbox h2') || {}).textContent || '';
          if (!document.querySelector('#modal').hidden && h === '금고 결과') return { vt, coins: +document.querySelector('.vtab td:last-child').textContent.replace(/,/g, '') };
          if (document.querySelector('#modal').hidden) __botStep();
          if (B.active && B.state === 'GROGGY') onTap(); }
        return 'vault never finished (state ' + B.state + ')'; };
      S.vault = null; S.gold = 0; S.gems = 100; const g0 = S.gold;
      challengeModal(); const go = document.querySelector('[data-m="vgo"]'); if (!go || document.querySelector('[data-m="vsw"]')) return 'entry button wrong before first play';
      go.click(); if (!(R && R.vault)) return 'vault did not start'; if (vday().used !== 1) return 'free entry not used';
      const r1 = vrun(1); if (typeof r1 === 'string') return r1;
      if (r1.coins < 20) return 'too few coins with a perfect bot: ' + r1.coins;
      if (r1.vt < 60000) return 'perfect bot lost all hearts at ' + r1.vt;
      if (vday().best !== r1.coins) return 'best not saved';
      if (S.gold - g0 !== vaultGold(r1.coins)) return `gold ${S.gold - g0} != ${vaultGold(r1.coins)}`;
      document.querySelector('[data-m="home"]').click();
      challengeModal(); const gs = S.gold; document.querySelector('[data-m="vsw"]').click();
      if (S.gold - gs !== vaultGold(Math.round(r1.coins * .8))) return 'sweep paid ' + (S.gold - gs);
      if (vaultEntry() !== 'ad') return 'after 2 free entries next should be ad, got ' + vaultEntry(); closeModal();
      vday().ad = true; if (vaultEntry() !== 'gem') return 'gem entry missing';
      useVaultEntry(() => startVault()); if (S.gems !== 70 || !R || !R.vault) return 'gem entry failed';
      const r2 = vrun(0); if (typeof r2 === 'string') return r2; if (r2.vt >= 60000) return 'a bot that never parries kept its hearts for 60s';
      document.querySelector('[data-m="home"]').click();
      if (vaultEntry() !== null) return 'entries left after all used';
      S.vault.d = '2000-01-01'; if (vaultFree() !== 2 || vday().best !== r1.coins) return 'daily reset broken';
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '전투 2.0 시험판: 빈틈 · 함정 · 밀치기 · 처형', run: () => {
      const trial = (v2, skill) => { __bot.skill = skill; startTrial(v2); let vt = 0;
        while (vt < 300000) { __tick(16); vt += 16; if (__errors.length) return 'error: ' + __errors[0];
          const h = (document.querySelector('#mbox h2') || {}).textContent || '';
          if (!document.querySelector('#modal').hidden && (h === '시험 대전 승리!' || h === '쓰러졌다...')) { closeModal(); return { win: h === '시험 대전 승리!', vt }; }
          if (document.querySelector('#modal').hidden) __botStep(); }
        return 'trial never finished (state ' + B.state + ')'; };
      let st = null; const orig = trialEnd; trialEnd = w => { st = JSON.parse(JSON.stringify(B.v2Stats)); orig(w); };
      let r1 = trial(true, .9); if (typeof r1 === 'string') return r1;
      if (!r1.win) { __seed(4242); r1 = trial(true, .9); if (typeof r1 === 'string') return r1; }   // ~1 in 8 seeds loses: allow one retry
      if (!r1.win) return 'a 90% bot lost the 2.0 trial twice';
      if (!st.bash) return 'no bashes happened'; if (!st.exec.length) return 'no execution happened'; if (!st.shove) return 'no shove happened';
      const r2 = trial(true, .3); if (typeof r2 === 'string') return r2;
      const r3 = trial(false, .9); if (typeof r3 === 'string') return r3;
      trialEnd = orig; S.trial = null;
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '마법 구체 랠리 · 벽꽝 · 헛손질 실드 감소', run: () => {
      __bot.skill = 1; __bot.sig = 10;
      startRun(7); R.room = 4; startFight(roomCfg(7, 'boss'), false); B.st.pool = { base: [['orb5', 1]] }; B.firstAtk = false; B.ehp = B.emax = 1e6;
      let vt = 0; while (vt < 40000 && !B.orbBooms) { __tick(16); vt += 16; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (!B.orbBooms) return 'orb rally never exploded on the boss (state ' + B.state + ')';
      startRun(2); startFight(roomCfg(2, 'min'), false); B.st.pool = { base: [['single', 1]] }; B.ehp = B.emax = 1e6; B.st.stunMult = 0;
      vt = 0; while (vt < 60000 && !B.slams) { __tick(16); vt += 16; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (!B.slams) return 'wall slam never happened (push ' + B.push + '/' + pushMax() + ')';
      for (let i = 0; i < 300 && B.state !== 'GROGGY'; i++) __tick(16); if (B.state !== 'GROGGY') return 'wall slam did not stun (state ' + B.state + ')';
      for (let i = 0; i < 600 && B.state !== 'IDLE'; i++) __tick(16);
      const s0 = B.psh; B.lastParryT = -1e9; B.mashGrace = 0; onTap(); for (let i = 0; i < 16; i++) __tick(16); if (!(B.psh < s0)) return 'tapping with no attack did not cost shield';
      if (!(B.stiffUntil > B.time)) return 'empty tap did not stiffen'; const ev = B.evadeT; onSwipe(-1); if (B.evadeT !== ev) return 'could dodge while stiff';
      __bot.sig = undefined;
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '연속 패링 골드 · 보스 발악 5연타 · 방패 놓침', run: () => {
      __bot.skill = 1; __bot.sig = 8;
      startRun(1); R.room = 4; startFight(roomCfg(1, 'boss'), false); B.st.pool = { base: [['single', 1]] }; B.st.stunMult = 0; const g0 = R.gold;
      let vt = 0; while (vt < 40000 && B.pStreak < 7) { __tick(16); vt += 16; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (!(R.gold > g0)) return 'parry streak dropped no gold (streak ' + B.pStreak + ')';
      B.phase2 = true; B.transformed = true; B.push = 0; B.ehp = Math.round(B.emax * .12); vt = 0; let sawDesp = false;
      while (vt < 40000 && B.state !== 'VICTORY') { __tick(16); vt += 16; if (B.atk && B.atk.kind === 'desp') sawDesp = true; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (!sawDesp) return 'boss never used the desperation 5-hit'; if (B.state !== 'VICTORY') return 'perfect desperation did not finish the boss (' + B.state + ')';
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle();
      startRun(3); startFight(roomCfg(3, 'min'), false); B.ehp = B.emax = 1e6; B.st.stunMult = 0; for (let i = 0; i < 200; i++) __tick(16);
      guardBreak(); if (!B.disarm) return 'guard break did not knock the shield away';
      vt = 0; let sawBarrage = false; while (vt < 30000 && B.disarm) { __tick(16); vt += 16; if (B.atk && B.atk.kind === 'barrage') sawBarrage = true; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (!sawBarrage) return 'no barrage after losing the shield'; if (B.disarm) return 'shield never recovered'; if (!(B.psh > 0)) return 'shield empty after pickup';
      __bot.sig = undefined;
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '보스 체력바 x20 · 페이즈2 변신 · 분노의 5연타', run: () => {
      __bot.skill = 1; __bot.sig = 8; for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle();
      startRun(3); R.room = 4; startFight(roomCfg(3, 'boss'), false); for (let i = 0; i < 20; i++) __tick(16);
      if (document.querySelector('#eBars').hidden || document.querySelector('#eBars').textContent !== 'x20') return 'boss bar counter not x20: ' + document.querySelector('#eBars').textContent;
      if (!document.querySelector('#ePhase').textContent.startsWith('PHASE 1')) return 'phase label missing';
      const sc0 = B.E.scale; B.ehp = 1; chip(5, 'x'); let vt = 0, sawT = false;
      while (vt < 20000 && !(B.transformed && B.state !== 'TRANSFORM')) { __tick(16); vt += 16; if (B.state === 'TRANSFORM') sawT = true; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (!sawT || !B.transformed) return 'boss never transformed in phase 2'; if (!(B.E.scale > sc0)) return 'boss did not grow';
      if (B.ehp !== B.emax || document.querySelector('#eBars').textContent !== 'x20') return 'phase 2 did not refill the bars: ' + document.querySelector('#eBars').textContent + ' ' + B.ehp + '/' + B.emax;
      if (B.state === 'VICTORY') return 'phase 1 KO ended the fight';
      if (!document.querySelector('#ePhase').textContent.startsWith('PHASE 2')) return 'phase 2 label missing';
      B.st.pool = { base: [['fury', 1]], p2: [['fury', 1]] }; B.st.stunMult = 0; B.stun = 0; B.ehp = B.emax * .4; vt = 0; let furyDone = false, st0 = 0;
      while (vt < 20000 && !furyDone) { __tick(16); vt += 16; if (B.atk && B.atk.kind === 'fury' && B.state === 'WINDUP') st0 = 1; if (st0 && B.state !== 'WINDUP') furyDone = true; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (!furyDone) return 'fury pattern never ran'; if (!(B.stun >= 35 || B.state === 'GROGGY')) return 'fully parried fury gave no stun (' + B.stun + ')';
      __bot.sig = undefined;
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '배경·벽은 흔들림/줌에도 고정', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle();
      const keepK = drawKnight, keepE = drawEnemy; drawKnight = () => {}; drawEnemy = () => ({ top: 0, w: 0 });
      let bad = null;
      for (const idx of [0, 1, 3, 6, 8]) {
        B.wallHitT = 99999; startRun(idx); startFight(roomCfg(idx, 'min'), false); if (B.wallHitT !== null) return 'wall slam timer leaked into the next fight'; for (let i = 0; i < 60; i++) __tick(16);
        B.push = pushMax() * .6; B.parts = []; B.fxs = []; B.shake = 0; B.zoom = 1; B.atk = null; setState('IDLE'); B.idleDur = 1e9; draw();
        const g = bcv.getContext('2d'), W = B.W, H = B.H, ref = g.getImageData(0, 0, W, H).data;
        B.shake = 6; B.zoom = 1.18; B.parts = []; B.fxs = []; draw(); const now = g.getImageData(0, 0, W, H).data; let diff = 0;
        let x0 = 999, x1 = -1, y0 = 999, y1 = -1;
        for (let i = 0; i < ref.length; i += 4) if (ref[i] !== now[i] || ref[i + 1] !== now[i + 1] || ref[i + 2] !== now[i + 2]) { diff++; const k = i / 4, x = k % W, y = Math.floor(k / W); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        if (diff) { bad = `region ${idx + 1}: ${diff} background pixels moved under shake/zoom (x ${x0}-${x1}, y ${y0}-${y1}, gy ${B.gy}, guard ${B.guard}, state ${B.state})`; break; }
        endBattle(); }
      drawKnight = keepK; drawEnemy = keepE; return bad || (__errors.length ? 'error: ' + __errors[0] : null); } },
    { name: '스테이지 별 평가 (★1~★3) · 보석 보상 · 로비 표시', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.stars = {}; const g0 = S.gems;
      const finish = (hp, perf, rev) => { startRun(2); B.active = false; R.hp = Math.round(R.maxHp * hp); R.tapN = 100; R.perfects = Math.round(perf * 100); R.revived = rev; runComplete();
        const n = document.querySelectorAll('#mbox .runstars i.on').length; document.querySelector('[data-m="take"]').click(); for (let i = 0; i < 60; i++) __tick(16); closeModal(); return n; };
      let n = finish(.2, .1, false); if (n !== 1 || S.stars[2] !== 1) return 'low hp + low perfect should be 1 star, got ' + n;
      n = finish(.8, .1, false); if (n !== 2 || S.stars[2] !== 2) return 'high hp only should be 2 stars, got ' + n;
      n = finish(.8, .6, true); if (n !== 1 || S.stars[2] !== 2) return 'revived run should be 1 star and keep best 2, got ' + n + '/' + S.stars[2];
      n = finish(.8, .6, false); if (n !== 3 || S.stars[2] !== 3) return 'great run should be 3 stars, got ' + n;
      if (S.gems - g0 < 15) return 'star gems not granted (' + (S.gems - g0) + ')';
      S.sel = 2; tab = 'battle'; showShell(); for (let i = 0; i < 30; i++) __tick(16);
      if (!document.querySelector('#chRibbon').textContent.includes('★')) return 'lobby star total missing';
      openMap(); if (!document.querySelector('#wmap .wm-node[data-k="2"] b')) return 'map node stars missing';
      if (document.querySelectorAll('#wmap .wm-node').length !== STAGES.length) return 'map does not show every stage';
      if (!/남은 스테이지/.test(document.querySelector('#mTxt').textContent)) return 'lobby does not show stages left';
      document.querySelector('#wmap .wm-node[data-k="1"]').click(); if (S.sel !== 1 || !document.querySelector('#wmap').hidden) return 'tapping a cleared map node did not select it';
      openMap(); const lk = document.querySelector(`#wmap .wm-node[data-k="${Math.min(S.cleared + 1, STAGES.length - 1)}"]`); lk.click(); if (document.querySelector('#wmap').hidden) return 'a locked node closed the map'; closeMap();
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '무리 관문 (4:1) · 피로도 가득 차면 패턴 끝에 기절', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); __bot.skill = 1; __bot.sig = 8; S.streak = 0;
      startRun(66); R.room = 1; { const pc = roomCfg(66, 'pack'); pc.packEach = Math.round(pc.packEach / 8); pc.hp = pc.packEach * pc.pack.length; startFight(pc, false); }   // light HP: this checks pack mechanics, not stage 67 balance if (!B.pack || B.pack.length !== 4) return 'pack of 4 not created';
      let vt = 0, backAtk = false; while (vt < 720000 && B.state !== 'VICTORY') { __tick(16); vt += 16; if (B.state === 'WINDUP' && B.packAtk > 0) backAtk = true; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (B.state !== 'VICTORY') return 'pack fight never finished (' + B.state + ', left ' + (B.pack && B.pack.length) + ')';
      if (B.packKills !== 3) return 'expected 3 front kills before the last one, got ' + B.packKills; if (!backAtk) return 'back members never attacked';
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle();
      startRun(3); startFight(roomCfg(3, 'min'), false); B.st.pool = { base: [['chain4', 1]] }; B.firstAtk = false; B.ehp = B.emax = 1e6; vt = 0;
      while (vt < 20000 && !(B.state === 'WINDUP' && B.atk.idx === 1)) { __tick(16); vt += 16; if (document.querySelector('#modal').hidden) __botStep(); }
      B.stun = 100; __tick(16); __tick(16); if (!B.finishReady) return 'full stagger mid-chain did not arm FINISH (' + B.state + ')';
      while (vt < 30000 && B.state === 'WINDUP') { __tick(16); vt += 16; __botStep(); } for (let i = 0; i < 30 && B.state !== 'GROGGY'; i++) __tick(16); if (B.state !== 'GROGGY') return 'no stun after the chain (' + B.state + ')';
      __bot.sig = undefined; return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '카드 시스템 제거: 관문 사이 카드 없음 · 상단은 피버 게이지', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 3; __bot.skill = 1; __bot.sig = 8;
      startRun(1); for (let i = 0; i < 5; i++) __tick(16); if (!document.querySelector('#modal').hidden && /카드/.test(document.querySelector('#mbox').textContent)) return 'win streak still offers starting cards';
      if (!document.querySelector('#cGauge').hidden) return 'card gauge still shown'; if (document.querySelector('#fGauge').hidden) return 'fever gauge not shown on top';
      let sawCard = false, rooms = 0, vt = 0; const r0 = R;
      while (vt < 400000 && R === r0 && R.room < 3) { __tick(16); vt += 16; const h = (document.querySelector('#mbox h2') || {}).textContent || ''; if (!document.querySelector('#modal').hidden) { if (h.startsWith('카드')) sawCard = true; __botStep(); } else __botStep(); }
      if (sawCard) return 'a card pick appeared between gates'; if (!(R && R.room >= 1)) return 'did not reach the next gates (' + (R && R.room) + ')';
      if (!((R.fv || 0) > 0)) return 'fever gauge did not fill over the gates';
      S.streak = 0; __bot.sig = undefined; for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle();
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '사람처럼 스와이프(터치→밀기)로 회피 공격 전부 피하기 · 기상 충격파', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 0;
      const humanDodge = (dir = -1) => { onTap(); onSwipe(dir); };
      // every pattern that contains a dodge note
      for (const name of Object.keys(PATMAKE)) { const P = PATMAKE[name](); if (!P.notes.some(n => n.type === 'swipe')) continue;
        startRun(9); R.room = 4; startFight(roomCfg(9, 'boss'), false); B.ehp = B.emax = 1e7; B.st.stunMult = 0; B.st.pool = { base: [[name, 1]] }; B.firstAtk = false;
        for (let i = 0; i < 150 && B.state !== 'WINDUP'; i++) __tick(16);
        let vt = 0, hits = 0; const h0 = window.hurt; window.hurt = function (d, l, g) { if (!g && B.atk && B.atk.notes[B.atk.idx] && B.atk.notes[B.atk.idx].type === 'swipe') hits++; return h0.apply(this, arguments); };
        let lastKey = '';
        while (vt < 15000 && B.state === 'WINDUP') { const a = B.atk, n = a.notes[a.idx], key = a.start + ':' + a.idx;
          if (n.type === 'swipe' && key !== lastKey && a.impact - B.time <= 180) { lastKey = key; humanDodge(n.dir || -1); }
          else if (n.type === 'jump' && key !== lastKey && a.impact - B.time <= 180) { lastKey = key; onTap(); onSwipeUp(); }
          else if (n.type === 'block') { if (key !== lastKey && a.impact - B.time <= 450) { lastKey = key; onTap(); } setGuard(a.impact - B.time <= 280); }
          else if (n.type === 'tap' && key !== lastKey && a.impact - B.time <= 20) { lastKey = key; onTap(); }
          else if (n.type === 'hold') setGuard(B.time >= n.t - 80);
          __tick(16); vt += 16; }
        window.hurt = h0; setGuard(false);
        if (hits) return `pattern ${name}: a touch-then-swipe dodge still got hit (${hits})`; endBattle(); }
      // wake shockwave after a stun, also right after mashing
      for (const idx of STAGES.map((s, i) => i).filter(i => STAGES[i].boss)) for (const mash of [false, true]) {
        startRun(idx); R.room = 4; startFight(roomCfg(idx, 'boss'), false); for (let i = 0; i < 150; i++) __tick(16); B.ehp = B.emax = 1e7;
        B.stun = 100; enterGroggy(); while (B.state === 'GROGGY') { __tick(16); if (mash) onTap(); }
        if (B.state !== 'WAKE') return `stage ${idx + 1}: no wake shockwave`;
        const hp0 = B.php, until = B.time + 250; let done = false;
        while (B.state === 'WAKE' && !B.atk.resolved) { if (mash && B.time < until) onTap(); if (!done && B.atk.impact - B.time <= 200) { done = true; humanDodge(); } __tick(16); }
        if (B.php < hp0) return `stage ${idx + 1}${mash ? ' (after mashing)' : ''}: dodged wake shockwave still hurt`; endBattle(); }
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '특수 동작: 짓누르기(꾹) · 휩쓸기(방향) · 점프(↑) · 잡기(연타 탈출)', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 0;
      const one = (name, act, post) => { startRun(3); R.room = 4; startFight(roomCfg(3, 'boss'), false); B.ehp = B.emax = 1e7; B.php = B.pmax = 1e6; B.st.stunMult = 0; B.st.pool = { base: [[name, 1]] }; B.firstAtk = false;
        for (let i = 0; i < 300 && B.state !== 'WINDUP'; i++) __tick(16);
        if (B.state !== 'WINDUP' || B.atk.name !== name) return { err: name + ': attack never started' };
        const out = { hurts: 0, labels: [] }, h0 = window.hurt; window.hurt = function (d, l, g) { if (!g) { out.hurts++; out.labels.push(l) } return h0.apply(this, arguments); };
        let vt = 0; const done = {};
        while (vt < 8000 && B.state === 'WINDUP') { const a = B.atk; act(a.notes[a.idx], a.impact - B.time, done, a.idx); __tick(16); vt += 16; }
        out.grabbed = !!B.grab; if (post) post(out); window.hurt = h0; setGuard(false); endBattle(); return out; };
      const once = (k, f) => (n, d, done, i) => { if (!done[k + i] && d <= 180) { done[k + i] = 1; f(n); } };
      let r = one('crush', (n, d, done) => { if (!done.t && d <= 450) { done.t = 1; onTap(); } setGuard(d <= 280); });
      if (r.err || r.hurts) return 'crush: holding the guard early still got hit ' + (r.err || r.labels);
      r = one('crush', (n, d, done) => { if (!done.t && d <= 20) { done.t = 1; onTap(); } });
      if (r.err || !r.hurts) return 'crush: a plain tap parried a guard-only attack';
      r = one('crush', once('s', () => { onTap(); onSwipe(-1); }));
      if (r.err || !r.hurts) return 'crush: a side dodge avoided a guard-only attack';
      r = one('sweepL', once('s', () => { onTap(); onSwipe(1); }));
      if (r.err || !r.labels.includes('반대쪽!')) return 'sweepL: dodging the wrong way was not punished ' + (r.err || r.labels);
      r = one('sweepL', once('s', () => { onTap(); onSwipe(-1); }));
      if (r.err || r.hurts) return 'sweepL: dodging the arrow way still got hit';
      r = one('sweepR', once('s', () => { onTap(); onSwipe(1); }));
      if (r.err || r.hurts) return 'sweepR: dodging the arrow way still got hit';
      r = one('lowsweep', once('s', () => { onTap(); onSwipeUp(); }));
      if (r.err || r.hurts) return 'lowsweep: a touch-then-swipe-up jump still got hit ' + (r.err || r.labels);
      r = one('lowsweep', once('s', () => { onTap(); onSwipe(-1); }));
      if (r.err || !r.hurts) return 'lowsweep: a side dodge avoided the low sweep';
      r = one('dance', once('s', n => { onTap(); if (n.type === 'jump') onSwipeUp(); else onSwipe(n.dir); }));
      if (r.err || r.hurts) return 'dance: ◀ ↑ ▶ done right still got hit ' + (r.err || r.labels);
      r = one('grab', once('s', () => { onTap(); onSwipe(1); }));
      if (r.err || r.hurts || r.grabbed) return 'grab: dodging still got grabbed';
      r = one('grab', (n, d) => setGuard(d <= 400), o => { if (!B.grab) { o.err = 'guarding did not get grabbed'; return }
        let k = 0; while (B.grab && k++ < 200) { onTap(); __tick(16); __tick(16); __tick(16); __tick(16); __tick(16); } o.escaped = !o.labels.includes('내동댕이!') && !B.grab;
        let w = 0; while (w++ < 300 && B.state !== 'WINDUP') __tick(16); o.next = B.state === 'WINDUP'; });
      if (r.err || !r.escaped || !r.next) return 'grab: mashing out failed ' + (r.err || JSON.stringify(r));
      r = one('grab', (n, d) => setGuard(d <= 400), o => { let k = 0; while (B.grab && k++ < 300) __tick(16); o.thrown = o.labels.includes('내동댕이!');
        let w = 0; while (w++ < 300 && B.state !== 'WINDUP') __tick(16); o.next = B.state === 'WINDUP'; });
      if (r.err || !r.thrown || !r.next) return 'grab: not mashing should throw the knight, then the fight goes on ' + (r.err || JSON.stringify(r));
      for (let i = 0; i < POOLS.length; i++) if (!POOLS[i].base.some(([n]) => PAT_INFO[n] && PAT_INFO[n][1] === 'action')) return `stage ${i + 1} has no action attacks`;
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '난타(파란 긴 노트): 실제 터치로 미리/박에 맞춰/살짝 늦게 눌러도 성공', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 0;
      const pad = document.querySelector('#pad'), r = pad.getBoundingClientRect(), ev = (type, id) => pad.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }));
      for (const [label, when] of [['미리(공격 전 대기 중)', 'idle'], ['박에 맞춰', 0], ['살짝 늦게', -90], ['한참 미리', 500]]) {
        startRun(33); R.room = 1; startFight(roomCfg(33, 'min'), false); B.ehp = B.emax = 1e6; B.st.stunMult = 0; B.st.pool = { base: [['hold', 1]] }; B.firstAtk = false;
        let g = 0; while (B.state !== 'IDLE' && g++ < 400) __tick(16); HZ[B.hz] && (HZ[B.hz].rate = 0);
        let hits = 0; const h0 = window.hurt; window.hurt = function (d, l, gd) { if (!gd) hits++; return h0.apply(this, arguments); };
        let down = false; const id = 7 + Math.floor(Math.random() * 1000);
        if (when === 'idle') { B.idleDur = B.time - B.stT + 250; ev('pointerdown', id); down = true; }
        g = 0; while (!(B.state === 'WINDUP' && B.atk.name === 'hold') && g++ < 400) __tick(16);
        const n = B.atk.notes[0];
        while (B.state === 'WINDUP' && g++ < 2000) { if (!down && when !== 'idle' && B.time >= n.t - when) { ev('pointerdown', id); down = true; } __tick(16); }
        const ok = B.atk && B.atk.holdOk; ev('pointerup', id); window.hurt = h0; HZ[B.hz] && (HZ[B.hz].rate = .14);
        if (!ok || hits) return `hold pressed ${label}: failed (holdOk ${ok}, hits ${hits}, stiff ${B.stiffUntil > 0})`;
        endBattle(); }
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '보스 등장 연출: 경고 → 실루엣 → 공개 → 전투 시작 · 탭 건너뛰기', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 0; window.__noBossIntro = false;
      startRun(24); R.room = 4; startFight(roomCfg(24, 'boss'), false);
      if (B.state !== 'BOSSIN' || !document.querySelector('#cine .bwarn')) return 'boss entrance did not start with a warning';
      let g = 0, sawSil = false; while (B.state === 'BOSSIN' && g++ < 400) { __tick(16); if (B.bossIn && !B.bossIn.shown && B.time - B.stT > 1200) sawSil = true; if (B.bossIn && B.bossIn.shown && !document.querySelector('#cineText').classList.contains('show')) return 'no name card after reveal'; }
      if (!sawSil) return 'no silhouette walk-in'; if (B.state !== 'IDLE') return 'fight did not start after the entrance (' + B.state + ')';
      if (document.querySelector('#cine').classList.contains('on')) return 'letterbox stayed on';
      let w = 0; while (B.state !== 'WINDUP' && w++ < 300) __tick(16); if (B.state !== 'WINDUP') return 'boss never attacked after the entrance';
      endBattle(); startRun(21); R.room = 4; startFight(roomCfg(21, 'boss'), false); if (B.state !== 'BOSSIN' || !document.querySelector('#cine .bwarn.keeper')) return 'keeper should get the warning entrance too';
      for (let i = 0; i < 40; i++) __tick(16); onTap(); __tick(16); if (B.state !== 'IDLE') return 'tap did not skip the entrance';
      endBattle(); startRun(24); R.room = 1; startFight(roomCfg(24, 'min'), false); if (B.state === 'BOSSIN') return 'minion got a boss entrance';
      endBattle(); window.__noBossIntro = true; return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '100 스테이지 · 챕터 지형 공격 · 몬스터 특성', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 0;
      if (STAGES.length !== 100 || REGIONS.length !== 100 || PARRY_TUNE.length !== 100 || POOLS.length !== 100) return 'tables are not 100 long';
      for (let i = 0; i < 100; i++) { const st = STAGES[i];
        if (!EN[st.kind]) return `stage ${i + 1}: unknown monster ${st.kind}`;
        for (const k of [...REGIONS[i].min.map(m => m[0]), REGIONS[i].elite[0]]) { if (!EN[k]) return `stage ${i + 1}: unknown minion ${k}`; if (!EN[k].trait) return `${k} has no trait`; }
        for (const [n] of POOLS[i].base.concat(POOLS[i].p2)) if (!PATMAKE[n]) return `stage ${i + 1}: pool has unknown pattern ${n}`;
        if ((i % 10 === 4 || i % 10 === 9) !== !!st.boss) return `stage ${i + 1}: boss flag wrong`;
        if (i % 10 && REGIONS[i].min.map(m => m[0]).join() === REGIONS[i - 1].min.map(m => m[0]).join()) return `stage ${i + 1} has the same minions as stage ${i}`;
        for (const ty of ['min', 'pack', 'elite', 'boss']) { const c = roomCfg(i, ty); if (!(c.hp > 0 && c.atk > 0)) return `stage ${i + 1} ${ty}: bad hp/atk`; } }
      for (const k in MINION_POOLS) for (const [n] of MINION_POOLS[k]) if (!PATMAKE[n]) return `minion ${k} uses unknown pattern ${n}`;
      for (let i = 1; i < 100; i++) { const a = stageHp(i), b = stageHp(i - 1); if (!(a > b * 1.02)) return `HP does not grow by a rate at stage ${i + 1}`; }
      if (!(STAGES[99].hp > STAGES[50].hp && STAGES[50].hp > STAGES[0].hp && STAGES[99].atk > STAGES[50].atk)) return 'difficulty does not grow';
      const fight = (idx, type) => { endBattle(); startRun(idx); R.room = type === 'boss' ? 4 : 1; startFight(roomCfg(idx, type), false); B.ehp = B.emax = 1e6; B.php = B.pmax = 1e5; for (let i = 0; i < 200; i++) __tick(16); };
      // map attacks: every chapter attack asks for its own move
      const mapAtk = (idx, name, act) => { fight(idx, 'min'); HZ[B.hz].rate = 0; while (B.state !== 'IDLE') __tick(16); B.forcePat = name; B.idleDur = 0;
        let g = 0; while (!(B.state === 'WINDUP' && B.atk.name === name) && g++ < 400) __tick(16); if (B.state !== 'WINDUP') return 'no attack'; B.atk.hz = B.hz;
        let hits = 0; const h0 = window.hurt; window.hurt = function (d, l, gd) { if (!gd) hits++; return h0.apply(this, arguments); };
        const s0 = B.stun, done = {}; g = 0; while (B.state === 'WINDUP' && g++ < 600) { act(B.atk.impact - B.time, done); __tick(16); }
        window.hurt = h0; setGuard(false); const r = { hits, stun: B.stun - s0, grab: !!B.grab }; HZ[B.hz].rate = .15; return r; };
      const guardIt = (d, done) => { if (!done.t && d <= 450) { done.t = 1; onTap(); } setGuard(d <= 280); };
      const jumpIt = (d, done) => { if (!done.j && d <= 160) { done.j = 1; onTap(); onSwipeUp(); } };
      const dodge = dir => (d, done) => { if (!done.s && d <= 160) { done.s = 1; onTap(); onSwipe(dir); } };
      let r = mapAtk(24, 'hzRock', guardIt); if (r === 'no attack' || r.hits) return 'cave rockfall: guarding still got hit ' + JSON.stringify(r);
      r = mapAtk(24, 'hzRock', dodge(-1)); if (!r.hits) return 'cave rockfall: a dodge avoided it';
      r = mapAtk(14, 'hzVineL', dodge(-1)); if (r.hits) return 'forest vine: dodging the arrow way got hit';
      r = mapAtk(14, 'hzVineR', dodge(-1)); if (!r.hits) return 'forest vine: dodging the wrong way was safe';
      r = mapAtk(34, 'hzMud', dodge(1)); if (r.hits || r.grab) return 'swamp hand: dodge did not avoid it';
      r = mapAtk(34, 'hzMud', guardIt); if (!r.grab) return 'swamp hand: guarding did not get grabbed';
      for (const [idx, nm] of [[54, 'hzSnow'], [64, 'hzLava'], [74, 'hzWave']]) { r = mapAtk(idx, nm, jumpIt); if (r.hits) return nm + ': jumping still got hit'; r = mapAtk(idx, nm, guardIt); if (!r.hits) return nm + ': guarding avoided a jump attack'; }
      r = mapAtk(84, 'hzBolt', guardIt); if (r.hits) return 'lightning: guarding still got hit';
      fight(84, 'min'); B.st.stunMult = 1; r = mapAtk(84, 'hzBolt', guardIt);
      // sand storm: dodge notes follow the wind
      fight(44, 'min'); HZ.sand.rate = 0; B.wind = 1; B.forcePat = 'heavy'; B.firstAtk = false; while (B.state !== 'IDLE') __tick(16); B.idleDur = 0; let g = 0; while (!(B.state === 'WINDUP' && B.atk.name === 'heavy') && g++ < 400) { __tick(16); if (B.state === 'IDLE' && !B.forcePat) B.forcePat = 'heavy'; }
      if (B.atk.notes[0].dir !== 1) return 'sand storm did not set the dodge direction';
      // traits
      fight(0, 'min'); if (EN[B.st.kind].trait !== 'regen') return 'slime is not regen'; B.ehp = B.emax * .5; B.eHitT = B.time - 9000; const e0 = B.ehp; for (let i = 0; i < 120; i++) __tick(16); if (!(B.ehp > e0)) return 'regen did not heal';
      fight(REGIONS.findIndex(r => EN[r.elite[0]].trait === 'thief'), 'elite'); if (EN[B.st.kind].trait !== 'thief') return 'no thief elite found'; R.gold = 1000; hurt(5, null, false); if (!(R.gold < 1000 && B.stolen > 0)) return 'thief did not steal'; B.stun = 100; enterGroggy(); if (R.gold !== 1000) return 'stolen gold not returned on stun';
      fight(REGIONS.findIndex(r => EN[r.min[1][0]].trait === 'poison'), 'min'); if (EN[B.st.kind].trait === 'poison') { B.php = 1000; hurt(5, null, false); const p0 = B.php; for (let i = 0; i < 80; i++) __tick(16); if (!(B.php < p0)) return 'poison did no damage over time'; }
      fight(REGIONS.findIndex(r => EN[r.min[1][0]].trait === 'revive'), 'min'); if (EN[B.st.kind].trait !== 'revive') return 'skeleton is not revive (' + B.st.kind + ')'; B.ehp = 0; victory(); if (B.state === 'VICTORY' || !(B.ehp > 0)) return 'skeleton did not revive'; B.ehp = 0; victory(); if (B.state !== 'VICTORY') return 'revived twice'; for (let i = 0; i < 250; i++) __tick(16); closeModal();
      fight(REGIONS.findIndex(r => EN[r.elite[0]].trait === 'rage'), 'elite'); if (EN[B.st.kind].trait !== 'rage') return 'orc is not rage'; B.ehp = B.emax * .4; for (let i = 0; i < 30 && !B.raged; i++) __tick(16); if (!B.raged) return 'rage did not trigger (' + B.state + ')';
      fight(REGIONS.findIndex(r => EN[r.min[1][0]].trait === 'freeze'), 'min'); if (EN[B.st.kind].trait !== 'freeze') return 'ice spirit is not freeze (' + B.st.kind + ')'; hurt(5, null, false); if (!(B.parryLock > B.time + 300)) return 'freeze did not lock the knight';
      endBattle(); return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '피버 타임 · 기절 게이지가 피해만큼 줄어듦', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 0; __bot.skill = 1; __bot.sig = 8;
      startRun(3); startFight(roomCfg(3, 'min'), false); B.ehp = B.emax = 1e6; B.st.stunMult = 0; B.st.pool = { base: [['single', 1]] };
      R.fv = FV_NEED - 3; let vt = 0; while (vt < 60000 && !fvReady()) { __tick(16); vt += 16; if (document.querySelector('#modal').hidden) __botStep(); if (__errors.length) return 'error: ' + __errors[0]; }
      if (!fvReady()) return 'fever gauge never filled from parries';
      __tick(16); lastHud = ''; updHud(); const fb = document.querySelector('#fvBtn'); if (fb.hidden) return 'FEVER button not shown when gauge is full';
      const fg = document.querySelector('#fGauge'); if (fg.hidden || !fg.classList.contains('ready')) return 'fever gauge not shown as ready';
      let g = 0; while (B.state !== 'WINDUP' && g++ < 400) __tick(16); onTap(); if (B.state === 'FEVER') return 'pad tap should not fire fever (button only)'; g = 0; while (B.state !== 'WINDUP' && g++ < 400) __tick(16); if (!fvReady()) return 'gauge lost without pressing the button';
      const e0 = B.ehp; fb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); if (B.state !== 'FEVER') return 'FEVER button did not unleash fever (' + B.state + ')';
      lastHud = ''; updHud(); if (!fb.hidden) return 'FEVER button still shown during fever';
      if (!document.querySelector('#fever').classList.contains('on')) return 'fever HUD not shown';
      let atk = false; vt = 0; while (B.state === 'FEVER' && vt < 8000) { __tick(16); vt += 16; if (B.state === 'WINDUP') atk = true; }
      if (atk) return 'enemy attacked during fever'; if (vt < 4100 || vt > 5600) return 'fever (1.6s cut-in + 3s strikes) should last about 4.6s (' + vt + 'ms)';
      if (!(e0 - B.ehp > B.wp.groggyTapDamage * 25)) return 'fever did not deal rapid damage (' + Math.round(e0 - B.ehp) + ')';
      if ((R.fv || 0) !== 0 || fvReady()) return 'fever gauge not emptied after use';
      R.fv = 0; B.combo = 0; feverParry(false); const g1 = R.fv; R.fv = 0; B.combo = 30; feverParry(false); if (!(R.fv > g1 * 1.8)) return 'combo does not speed up the fever gauge';
      R.fv = 50; startFight(roomCfg(3, 'min'), true); if (R.fv !== 50) return 'fever gauge reset between gates';
      R.fv = 0; for (let i = 0; i < 20; i++) __tick(16);
      endBattle(); startRun(3); startFight(roomCfg(3, 'min'), false); for (let i = 0; i < 200; i++) __tick(16); while (B.state !== 'IDLE') __tick(16); B.ehp = B.emax = B.wp.groggyTapDamage * 60; B.stun = 100; for (let i = 0; i < 3; i++) __tick(16);
      if (B.state !== 'GROGGY') return 'no stun'; updHud(); const w0 = parseFloat(hud.eStun.style.width);
      for (let k = 0; k < 6; k++) { B.lastBashT = -1e9; groggyHit(); __tick(16); } lastHud = ''; updHud(); const w1 = parseFloat(hud.eStun.style.width);
      if (!(w1 < w0 - 5)) return `stun gauge did not shrink with damage (${w0} → ${w1})`;
      endBattle(); startRun(3); startFight(roomCfg(3, 'min'), false); for (let i = 0; i < 200; i++) __tick(16); while (B.state !== 'IDLE') __tick(16); B.ehp = B.emax = B.wp.groggyTapDamage * 40; B.stun = 100; for (let i = 0; i < 3; i++) __tick(16);
      for (let k = 0; k < 4; k++) { B.lastBashT = -1e9; groggyHit(); __tick(16); } if (B.state !== 'GROGGY') return 'a strong shield ended the stun after 4 hits (stun must allow ~12 hits)';
      __bot.sig = undefined; endBattle(); return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '피버가 다음 전투로 안 넘어감 · 스테이지·보스 음악 200곡 · 보스 대표기 · 스테이지별 피로도', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 0;
      startRun(2); startFight(roomCfg(2, 'min'), false); for (let i = 0; i < 200; i++) __tick(16); R.fv = FV_NEED; if (!feverStart()) return 'fever did not start'; for (let i = 0; i < 20; i++) __tick(16);
      if (!document.querySelector('#battle').classList.contains('fever')) return 'fever UI did not turn on';
      B.ehp = 0; B.pendingKO = true; for (let i = 0; i < 160; i++) __tick(16); closeModal();
      startFight(roomCfg(2, 'min'), true); for (let i = 0; i < 10; i++) __tick(16);
      if (document.querySelector('#battle').classList.contains('fever') || document.querySelector('#fever').classList.contains('on')) return 'fever UI leaked into the next fight';
      if (document.querySelectorAll('#fvMeter i.on').length) return 'fever meter leaked into the next fight';
      const sigs = new Set();
      for (let i = 0; i < 100; i++) for (const k of ['st' + i, 'bs' + i]) { const sg = SONGS[k]; if (!sg || sg._m.length !== 128 || sg._b.length !== 128 || sg._cm.length !== 16) return 'song ' + k + ' missing';
        for (const n of sg._m.concat(sg._b, sg._m2)) if (n !== '.' && n !== '-' && !(typeof n === 'number' && isFinite(mf(n)))) return `song ${k} has a bad note ${n}`;
        if (!(sg.bpm >= 100 && sg.bpm <= 170)) return `song ${k} tempo ${sg.bpm}`; sigs.add(sg.bpm + ':' + sg._m.slice(0, 32).join(',')); }
      if (sigs.size < 195) return 'stage songs are not distinct (' + sigs.size + '/200)';
      for (const i of [4, 44, 99]) if (roomCfg(i, 'boss').music !== 'bs' + i || roomCfg(i, 'min').music !== 'st' + i) return 'stage music not wired';
      for (const i of [4, 9, 59, 99]) { const c = roomCfg(i, 'boss'), sg = BOSS_SIG[c.kind]; if (!sg) return 'boss ' + c.kind + ' has no signature moves';
        for (const [pt] of sg) if (!PATMAKE[pt]) return 'signature pattern ' + pt + ' missing';
        const agg = {}; c.pool.base.forEach(([n, w]) => agg[n] = (agg[n] || 0) + w); const tot = Object.values(agg).reduce((a, b) => a + b, 0), sh = sg.reduce((a, [pt]) => a + agg[pt], 0) / tot;
        if (sh < .55) return `boss ${c.kind} signature share only ${Math.round(sh * 100)}%`; }
      const need = idx => { startRun(idx); const c = roomCfg(idx, 'boss'); startFight(c, false); const g = B.sh.stunDamage * B.st.stunMult * 1.3; endBattle(); return Math.ceil(100 / g); };
      S.shLv = 4; S.shStage = 0; const n0 = need(0); S.shLv = 40; S.shStage = 3; const n9 = need(99); S.shLv = 1; S.shStage = 0;
      if (n0 < 5 || n9 < 9 || n9 <= n0) return `perfect parries to stun: stage 1 = ${n0}, stage 10 = ${n9} (expected ~6 → ~11+)`;
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '전투 중 새 패턴 안내 없음 · 패턴 도감 · FINISH', run: () => {
      for (let i = 0; i < 200; i++) __tick(16); closeModal(); endBattle(); S.streak = 0; window.__noTips = false; S.seenPat = {}; __bot.skill = 1; __bot.sig = 8;
      startRun(4); startFight(roomCfg(4, 'min'), false); B.ehp = B.emax = 1e6; B.st.stunMult = 0; B.st.pool = { base: [['gallop', 1]] }; B.firstAtk = false;
      let vt = 0, paused = false; while (vt < 8000) { __tick(16); vt += 16; if (!document.querySelector('#modal').hidden) { paused = true; break; } __botStep(); }
      window.__noTips = true; if (paused) return 'a popup interrupted the fight: ' + (document.querySelector('#mbox h2') || {}).textContent;
      if (!S.seenPat.gallop) return 'met pattern not recorded for the book';
      endBattle(); startRun(4); startFight(roomCfg(4, 'min'), false); B.ehp = B.emax = 1e6; B.st.stunMult = 0; B.st.pool = { base: [['stream8', 1]] }; B.firstAtk = false; vt = 0;
      while (vt < 20000 && !(B.state === 'WINDUP' && B.atk.idx === 2)) { __tick(16); vt += 16; __botStep(); }
      B.stun = 100; __tick(16); __tick(16);
      if (B.state !== 'WINDUP' || !B.finishReady) return 'full stagger mid-phrase should wait for the phrase (state ' + B.state + ')';
      vt = 0; while (vt < 8000 && B.state === 'WINDUP') { __tick(16); vt += 16; __botStep(); }
      for (let i = 0; i < 30 && B.state !== 'GROGGY'; i++) __tick(16);
      if (B.state !== 'GROGGY') return 'no stun right after the phrase ended (' + B.state + ')';
      if (!B.finishBonus) return 'perfect finish bonus missing (perfect bot)';
      __bot.sig = undefined; endBattle(); helpModal(); document.querySelector('[data-m="book"]').click();
      for (const [k] of PAT_CATS) { document.querySelector(`[data-m="c_${k}"]`).click(); if (!document.querySelectorAll('#mbox .pbrow').length) return 'empty pattern book tab ' + k; }
      const named = Object.keys(PATMAKE).filter(k => !PAT_INFO[k]); if (named.length) return 'patterns missing from the book: ' + named.join(',');
      closeModal(); return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '피버 화면이 항상 꺼짐: 컷인 중 처치 · 2페이즈 변신 · 부활 · 관문 이동', run: () => {
      const cutOn = () => document.querySelector('#fvcut').classList.contains('on');
      for (const [i, type, kill] of [[0, 'boss', true], [22, 'min', true], [23, 'elite', false], [49, 'boss', true], [99, 'boss', false], [22, 'min', false]]) {
        endBattle(); startRun(i); R.room = type === 'boss' ? 4 : 1; startFight(roomCfg(i, type), false); let g = 0; while (B.state !== 'IDLE' && g++ < 600) __tick(16);
        if (kill) B.ehp = Math.max(1, B.emax * .01); R.fv = FV_NEED; if (!feverStart()) return 'fever did not start at stage ' + (i + 1);
        if (!cutOn()) return 'cut-in not shown';
        const e0 = B.ehp; onTap(); if (B.ehp !== e0) return 'taps during the cut-in should not deal damage';
        if (kill) { for (let k = 0; k < 20; k++) __tick(16); B.ehp = 0; B.pendingKO = true; }
        for (let k = 0; k < 500; k++) { __tick(16); if (document.querySelector('#modal').hidden && B.state !== 'FEVER') __botStep(); }
        if (cutOn()) return `fever cut-in stuck on screen (stage ${i + 1} ${type}${kill ? ' KO' : ''}, state ${B.state})`;
        if (document.querySelector('#battle').classList.contains('fever') && !feverOn()) return `fever UI stuck after fever ended (stage ${i + 1})`;
        if (B.state === 'FEVER' && !(B.fever > B.time)) return 'stuck in FEVER state'; }
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '패턴 조작 가능성: 회피 쿨타임·점프 쿨타임·버티기 직후 여유 (최고 템포 기준)', run: () => {
      const bad = [];
      for (const k in PATMAKE) { if (/^(hz|chart|barrage|orb|desp|fury|chaos)/.test(k)) continue; const ns = PATMAKE[k]().notes;
        for (let i = 0; i < ns.length; i++) { const n = ns[i];
          for (let j = i - 1; j >= 0; j--) if (n.type === 'swipe' && ns[j].type === 'swipe') { if (n.o - ns[j].o < 2.5) bad.push(`${k}: dodges ${ns[j].o}→${n.o}`); break; }
          for (let j = i - 1; j >= 0; j--) if (n.type === 'jump' && ns[j].type === 'jump') { if (n.o - ns[j].o < 2) bad.push(`${k}: jumps ${ns[j].o}→${n.o}`); break; }
          if (i > 0 && ns[i - 1].type === 'hold' && n.o - ns[i - 1].o - (ns[i - 1].len || 0) < .5) bad.push(`${k}: no room after hold`); } }
      if (bad.length) return 'unplayable at 170 BPM x1.12: ' + bad.slice(0, 6).join(' | ');
      // every regular monster from stage 11 on has moves of its own, and the mirror note flips before impact
      for (const i of [24, 54, 74, 94]) { R = R || {}; const e = roomCfg(i, 'elite'); if (!ownPats(e.kind, i).length && !SIG[e.kind]) return `elite ${e.kind} at stage ${i + 1} has no moves of its own`; }
      endBattle(); startRun(44); startFight(roomCfg(44, 'min'), false); B.php = B.pmax = 1e7; B.hz = null; for (let i = 0; i < 200; i++) __tick(16); let g = 0; while (B.state !== 'IDLE' && g++ < 400) __tick(16);
      B.ehp = B.emax = 1e7; B.php = B.pmax = 1e7; B.hz = null; B.forcePat = 'mirage'; B.idleDur = 0; g = 0; while (!(B.state === 'WINDUP' && B.atk && B.atk.name === 'mirage') && g++ < 400) __tick(16);
      const mn = B.atk && B.atk.notes.find(n => n.flip); if (!mn) return 'mirror note missing (' + B.state + ' ' + (B.atk && B.atk.name) + ' g' + g + ')'; const d0 = mn.dir; g = 0; const mi = B.atk.notes.indexOf(mn); B.atk.notes.slice(0, mi).forEach(n => n.res = true); B.atk.idx = mi; B.atk.impact = mn.t;
      while (B.atk && B.atk.notes.includes(mn) && !mn.res && mn.t - B.time > 300 && g++ < 600) __tick(16);
      if (!mn.flipped || mn.dir !== -d0) return 'mirror note did not flip before impact';
      return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '보스 2페이즈: 전용 각성기 과반 · 공격력·속도 상승', run: () => {
      R = R || {};
      for (let i = 4; i < 100; i += 5) { const c = roomCfg(i, 'boss'), ex = BOSS_P2[c.kind]; if (!ex) return `boss ${c.kind} has no phase-2 moves`;
        for (const [pt] of ex) { if (!PATMAKE[pt]) return 'missing pattern ' + pt; if (c.pool.base.some(([n]) => n === pt)) return `${c.kind}: phase-2 move ${pt} also used in phase 1`; }
        const W = c.pool.p2.reduce((a, b) => a + b[1], 0), sh = c.pool.p2.filter(([n]) => ex.some(([pt]) => pt === n)).reduce((a, b) => a + b[1], 0) / W;
        if (sh < .5) return `${c.kind}: phase-2 moves only ${Math.round(sh * 100)}% of phase 2`; }
      endBattle(); startRun(19); R.room = 4; startFight(roomCfg(19, 'boss'), false); for (let i = 0; i < 200; i++) __tick(16);
      const a1 = B.st.atk; startTransform(); if (!(B.st.atk > a1 * 1.1) || !B.p2T || !(B.p2T.idle < 1)) return 'phase 2 did not raise attack / speed';
      endBattle(); return __errors.length ? 'error: ' + __errors[0] : null; } },
    { name: '모든 패턴 생성', run: () => {
      startRun(9); R.room = 4; startFight(roomCfg(9, 'boss'), false); for (let i = 0; i < 200; i++) __tick(16);
      for (const k in PATMAKE) { const P = PATMAKE[k](); if (!P.notes || !P.notes.length) return 'pattern ' + k + ' has no notes'; }
      for (const k in EN) { try { getEnemy(k, 0); getEnemy(k, 1); } catch (e) { return 'sprite ' + k + ': ' + e.message; } }
      return __errors.length ? 'error: ' + __errors[0] : null; } },
  ];

      return scenarios.map(sc => { let r; try { r = sc.run(); } catch (e) { r = 'threw: ' + e.message; } try { endBattle(); } catch (_) {} return [sc.name, r]; });
    });
    for (const [name, r] of res) { total++; console.log(`[시나리오] ${r ? 'FAIL' : 'ok'} ${name} ${r || ''}`); if (r) fails.push(`[시나리오 ${name}] ${r}`); }
    await page.close();
  }

  // speech bubbles must never sit under the HUD, for every monster (present and future) and several screen ratios
  for (const [vw, vh] of [[360, 640], [390, 844], [430, 932], [412, 600], [768, 1024]]) {
    total++;
    const page = await browser.newPage({ viewport: { width: vw, height: vh } });
    page.on('pageerror', e => fails.push(`[말풍선 ${vw}x${vh}] pageerror: ${e.message}`));
    await page.addInitScript(CLOCK);
    await page.addInitScript(`localStorage.setItem('otpk-save-v1',JSON.stringify({intro:true,prologue:true,login:'guest',snd:false,bgm:false,cleared:9}))`);
    await page.goto(FILE);
    const r = await page.evaluate(() => {
      for (let i = 0; i < 60; i++) __tick(16); document.querySelector('#sSkip').click(); __tick(16); document.querySelector('#tStart').click(); for (let i = 0; i < 30; i++) __tick(16); closeModal();
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const scales = k => [EN[k].scale, Math.max(EN[k].scale, 3), Math.round(Math.max(EN[k].scale, 3) * 1.15 * 10) / 10];
      for (const kind of Object.keys(EN)) for (const sc of scales(kind)) {
        startRun(2); startFight(Object.assign(roomCfg(2, 'min'), { kind, scale: sc, line: '', taunt: '' }), false); for (let i = 0; i < 5; i++) __tick(16);
        fx.innerHTML = ''; bubble('이 방패 하나로 여기까지 오다니... 이제 진짜 절망을 보여주마!', true, 99999); bubble('공주님을 돌려받으러 왔다. 이 방패 하나로!', false, 99999);
        const ar = arena.getBoundingClientRect(), hud = [...document.querySelectorAll('#battle .bhud .bh-row, #battle .bhud .en-row, #battle .bhud .hprow, #battle .bhud #eStunBar')].map(e => e.getBoundingClientRect()).filter(q => q.height);
        for (const b of document.querySelectorAll('#fx .bubble')) { const q = b.getBoundingClientRect();
          if (hud.some(h => hit(q, h))) return `${kind} x${sc}: bubble overlaps the HUD`;
          if (q.left < ar.left - 1 || q.right > ar.right + 1) return `${kind} x${sc}: bubble leaves the screen`; }
        endBattle(); }
      // cinematic: the transformed boss must fit between the HUD/bars and the bottom bar
      for (let idx = 0; idx < STAGES.length; idx++) { startRun(idx); R.room = 4; startFight(roomCfg(idx, 'boss'), false);
        const sc = Math.round(B.E.scale * 1.15 * 10) / 10, f = cineFrame(sc, B.st.kind);
        if (f.bh * f.z > f.bot - f.top + 1) return `stage ${idx + 1} boss (${Math.round(f.bh * f.z)}px) does not fit the cinematic frame (${Math.round(f.bot - f.top)}px)`; endBattle(); }
      return __errors.length ? 'error: ' + __errors[0] : null; });
    console.log(`[말풍선 ${vw}x${vh}] ${r ? 'FAIL ' + r : 'ok'} 모든 몬스터 말풍선 · 2페이즈 화면 배치`); if (r) fails.push(`[말풍선 ${vw}x${vh}] ` + r);
    await page.close();
  }

  {
    total++;
    const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
    page.on('pageerror', e => fails.push(`[프롤로그] pageerror: ${e.message}`));
    await page.addInitScript(CLOCK);
    await page.addInitScript(`localStorage.setItem('otpk-save-v1',JSON.stringify({snd:false,bgm:false}))`);
    await page.goto(FILE);
    await page.addScriptTag({ content: BOT });
    const r = await page.evaluate(() => {
      __bot.skill = 1; for (let i = 0; i < 60; i++) __tick(16); document.querySelector('#sSkip').click();
      let vt = 0;
      while (vt < 120000) { __tick(16); vt += 16;
        if (__errors.length) return 'error: ' + __errors[0];
        if (!document.querySelector('#story').hidden) document.querySelector('#sSkip').click();
        else if (typeof B !== 'undefined' && B.active) __botStep();
        if (!document.querySelector('#title').hidden) { const seen = new Set(__bot.log.filter(x => String(x).startsWith('tut:')).map(x => x.split(':')[1])); const miss = ['0','1','2','4','5','6'].filter(k => !seen.has(k)); const les = new Set(__bot.log.filter(x => /^tut:1\d:lesson$/.test(x))); return !S.prologue ? 'title shown but prologue not marked done' : miss.length ? 'tutorial steps never shown: ' + miss.join(',') : les.size !== LESSONS.length ? `only ${les.size}/${LESSONS.length} action lessons shown` : null; } }
      return 'prologue never reached the title (state ' + (typeof B !== 'undefined' ? B.state : '?') + ')'; });
    console.log(`[프롤로그] ${r ? 'FAIL ' + r : 'ok'} 꿈속 마왕전 → 타이틀`); if (r) fails.push('[프롤로그] ' + r);
    await page.close();
  }
  await browser.close();
  console.log(`\n${total - new Set(fails.map(f => f.split(']')[0])).size}/${total} runs passed`);
  if (fails.length) { console.log('FAILURES:\n' + fails.join('\n')); process.exit(1); }
  console.log('ALL GOOD');
})();
