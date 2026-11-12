# Generates flowing (B-plan) charts: the enemy calls the next phrase while you answer the previous one.
# Usage: python3 tools/chart-gen.py out.json  — prints bar counts, fails if a dodge/jump sits within half a beat of another note.
# Paste each stage's bars into CHART_LV in index.html (stage 1 is hand-written there).
import json,sys
CONV={'c':'t','q':'h','x':'d','u':'j','f':'.','=':'=','.':'.'}
def ans(call,shift=0,hide=False):
    a=''.join(CONV.get(ch,'.') for ch in call)
    if shift: a=('.'*shift+a)[:len(a)]
    if hide: a=a.translate(str.maketrans('thdj','THDJ'))
    return a
HIT=set('tThHdDjJ')
# ===== 100-stage difficulty plan: inputs per second. 10 chapters x 10 stages; 5 = mid boss, 10 = chapter boss, 6 dips (new rule) =====
def target(idx):
    ch,pos=idx//10,idx%10
    return round(1.15+1.55*(ch/9)**1.15+[0,.03,.06,.09,.23,.07,.11,.15,.19,.35][pos],2)
BPM={0:110,1:112,2:108,3:116,4:120,5:112,6:114,7:108,8:116,9:120}
def density(bars,bpm):
    dur=0;n=0;tm=1
    for b in bars:
        x=b
        while x.startswith('{'):
            tg=x[1:x.index('}')];x=x[x.index('}')+1:]
            if tg.startswith('bpm:'): tm=float(tg[4:])
        dur+=240/(bpm*tm)
        if x[:2] in ('S:','G:','K:') or x in ('R','E','S','G','K'): continue
        h=x.split('/')[1] if '/' in x else x
        n+=sum(ch in HIT for ch in h)
    return n/dur
def ok_spacing(bars):
    seq=[]
    for bi,b in enumerate(bars):
        x=b
        while x.startswith('{'): x=x[x.index('}')+1:]
        h=x.split('/')[1] if '/' in x else ('' if x[:2] in('S:','G:','K:') or x in('R','E','S','G','K') else x)
        if len(h)!=8: continue
        for i,ch in enumerate(h):
            if ch in 'tThHdDjJ': seq.append((bi*8+i,ch))
    return all(not((a[1] in 'dDjJ' or b[1] in 'dDjJ') and b[0]-a[0]<2) for a,b in zip(seq,seq[1:]))
# ===== musical fitting: whole tap patterns are swapped for idioms from a rhythm vocabulary (never single notes punched out) =====
VOCAB8={2:['c...c...','c.....c.'],
        3:['c.c.c...','c...c.c.','c.c...c.','cc..c...','c...cc..','c..c..c.'],
        4:['c.c.c.c.','cc..c.c.','c.cc.c..','c.c.cc..','cc..cc..','c..c.cc.'],
        5:['cc.cc.c.','c.cc.cc.','cc.c.cc.','c.c.cc.c'],
        6:['cc.cc.cc','cccc.cc.']}
VOCAB12={2:['c.....c.....'],3:['c..c..c.....','c.....c..c..','c.cc..c.....'],4:['c..c..c..c..','c.cc..c..c..','c..c..c.cc..'],
         5:['c.cc..c.cc..','ccc...c..c..'],6:['c.cc.cc..c..','ccc...ccc...']}
def taponly(p): return set(p)<= set('c.')
def npos(p): return {i for i,ch in enumerate(p) if ch=='c'}
def down(p):
    """the vocabulary idiom with one note fewer that keeps the most of p's rhythm (and its downbeat)"""
    V=VOCAB12 if len(p)==12 else VOCAB8;n=p.count('c')
    cands=[q for q in V.get(n-1,[]) if q[0]=='c']
    if not cands: return None
    P=npos(p);return max(cands,key=lambda q:(len(P&npos(q)),-abs(len(P)-len(npos(q)))))
def fit(k,blocks):
    """bring a stage onto its planned density by simplifying its EARLIEST tap phrases first (later ones keep their richness)"""
    tgt=target(k)
    for _ in range(120):
        bars=build(blocks);d=density(bars,BPM[k])
        if d<=tgt+.015: return bars
        order=[]
        for st,items in blocks:
            for kind,pat,o in items:
                if kind=='c' and taponly(pat) and 'ans' not in o and 'habit' not in o.get('tag','') and pat not in order and down(pat): order.append(pat)
        best=None
        for p in order:
            q=down(p);nb=[(st,[(kind,(q if (kind=='c' and pat==p) else pat),o) for kind,pat,o in items]) for st,items in blocks]
            bb=build(nb)
            if not ok_spacing(bb): continue
            dd=density(bb,BPM[k])
            if dd>=tgt-.03: best=nb;break
        if best is None: return bars
        blocks=best
    return build(blocks)
def C(p,**o): return ('c',p,o)
def SELF(b,**o): return ('s',b,o)
def build(blocks):
    """blocks: list of (stunChar|None, items). Each block ends with its stun bar; the stun carries the next block's first call."""
    bars=["R"];pending=None
    for bi,(stun,items) in enumerate(blocks):
        for ii,(kind,pat,o) in enumerate(items):
            tag=o.get('tag','')
            if bi>0 and ii==0 and kind=='c':
                continue   # already placed inside the previous stun bar
            if kind=='c':
                bars.append(tag+pat+('/'+pending if pending else ''))
                pending=o.get('ans') or ans(pat,o.get('shift',0),o.get('hide',False))
            else:
                if pending:
                    if not any(ch in HIT for ch in pat): bars.append(tag+pat+'/'+pending);pending=None;continue
                    bars.append('......../'+pending);pending=None
                bars.append(tag+pat)
        if pending: bars.append('......../'+pending);pending=None
        nxt=blocks[bi+1][1][0] if bi+1<len(blocks) else None
        st=stun['tag'] if isinstance(stun,dict) else ''
        ch=stun['m'] if isinstance(stun,dict) else stun
        if nxt and nxt[0]=='c':
            bars.append(st+nxt[2].get('tag','')+ch+':'+nxt[1]);pending=nxt[2].get('ans') or ans(nxt[1],nxt[2].get('shift',0),nxt[2].get('hide',False))
        else: bars.append(st+ch)
    bars.append('E');return bars
def three(p,**o): return [C(p,**o),C(p,**o),C(p,hide=True,**o)]
S={}
# 2: holds (slime) — 1.2/s
S[1]=fit(1,[( 'S',[C('c.c.c...'),C('q==.c...'),C('c.c.c...'),C('q==.c.c.'),C('c.c.c.c.'),C('c.c.q==.'),C('q==.c.c.'),C('c.c.c...')]),
            ( 'K',[C('c.c.c.c.'),C('q==.c.c.'),C('{habit}c.cc.cc.',tag='{habit}') if False else C('c.cc.cc.',tag='{habit}'),C('c.c.q==.'),C('q==.c.c.'),C('c.c.c.c.'),C('q==.c.c.')]),
            ( 'S',[C('c.c.q==.'),C('c.c.c.c.'),C('q==.c.c.'),C('c.cc.c..'),C('c.c.q==.'),C('q==.c.c.')])])
# 3: swing, 12-grid (bee) — 1.25/s
S[2]=fit(2,[( 'S',[C('c.....c.....'),C('c..c..c.....'),C('c.....c..c..'),C('c..c..c..c..'),C('c.....c..c..'),C('c..c..c.....'),C('c..c..c..c..')]),
            ( {'m':'G','tag':'{say:새 연타: 정박에만!}'},[C('ccc...c.....',tag='{habit}'),C('c..c.cc.....'),C('c.c..c..c...'),C('c..c..c..c..'),C('c..c..c..c..'),C('c..c..c..c..'),C('c..c.cc.....')]),
            ( 'S',[C('c.c..c..c...'),C('c..c.cc..c..'),C('c..c..c..c..'),C('c..c..c.....'),C('ccc...c.....'),C('c..c..c..c..')])])
# 4: 7-count (goblin) — 1.3/s ; pulse phrases close a block
S[3]=fit(3,[( 'S',[C('c.c.c...'),C('c.c.c.c.'),C('c.cc.c..'),C('c.c.c.c.'),C('cc.c.c..'),SELF('p.p.p.p.'),SELF('p.p.t...')]),
            ( 'G',[C('c.c.c.c.'),C('c..c..c.',tag='{habit}'),C('c.c.c.c.'),C('c.cc.c..'),C('cc.c.cc.'),SELF('i.p.p.p.'),SELF('p.p...t.')]),
            ( 'S',[C('c.c.c.c.'),C('c.cc.cc.'),C('c..c..c.'),C('cc.cc.c.'),C('c.c.cc..'),SELF('p.p.p.p.'),SELF('p.p.t...')])])
# 5: King Slime boss — threes, third hidden — 1.45/s
S[4]=fit(4,[( 'S',three('c.c.c...')+three('c.c.c.c.')),
            ( {'m':'K','tag':'{fx:-}'},[C('c..c..c.',tag='{fx:sway}')]+[C('c..c..c.'),C('c..c..c.',hide=True)]+three('q==.c.c.')),
            ( 'G',three('c.....c..c..')+three('c..c..c..c..')),
            ( 'S',[C('c.c.c.c.'),C('c.cc.cc.'),C('cc.c.cc.'),SELF('i.p.p.p.'),SELF('p.p...t.')]),
            ( {'m':'S','tag':'{fx:-}'},[C('cc.cc.c.',tag='{bpm:1.12}{fx:sway}{say:왕 슬라임이 화났다! 빨라진다!}'),C('cc.cc.c.'),C('cc.cc.c.',hide=True),C('cccc.ccc'),C('q==.cc.c'),C('q==.cc.c'),C('q==.cc.c',hide=True)])])
# 6: dodge (old goblin) — 1.4/s
S[5]=fit(5,[( 'S',[C('x...x.c.'),C('c.c.x...'),C('x...c.c.'),C('c.c.x...'),C('x.c.c...'),C('c.x.c...'),C('c.c.x.c.')]),
            ( 'G',[C('x...c.c.'),C('q===c...',tag='{habit}'),C('c.x.c...'),C('x...c.c.'),C('c.c.x...'),C('x.c.c...'),C('c.c.x.c.')]),
            ( 'S',[C('c.x.c.x.'),C('x.c.c.x.'),C('c.c.x.c.'),C('x...c.c.'),C('c.x.c.x.'),C('c.c.c.x.'),C('x.c.c.c.')])])
# 7: jump, shuffle (giant goblin) — 1.45/s
S[6]=fit(6,[( 'K',[C('u...u...'),C('c.c.u...'),C('u...c.c.'),C('c.u.c...'),C('u...c.c.'),C('c.c.u...'),C('x...u.c.')]),
            ( 'S',[C('c..c..c.',tag='{habit}'),C('q=..u...'),C('c.x.u.c.'),C('u.c.c.c.'),C('c.u.c.c.'),C('u...c.c.'),C('c.c.u...')]),
            ( 'S',[C('c.u.c.x.'),C('u.c.x.c.'),C('c.c.u.c.'),C('x.u.c...'),C('u.c.u.c.'),C('c.x.u.c.'),C('c.c.u.c.')])])
# 8: offbeat answers + fakes (wild slime) — 1.5/s
O=dict(shift=1)
S[7]=fit(7,[( 'G',[C('c.cc.c..',**O),C('c.f.c.f.',tag='{say:가짜 부르기! 따라 치지 말고 참기}',**O),C('cc.cc.c.',**O),C('c.cc.cc.',tag='{habit}',**O),C('c.cc.cc.',**O),C('c.c.c.c.',**O),C('x.c.cc..',**O)]),
            ( 'S',[C('c.c.u...',**O),C('cc.cc.c.',**O),C('c.c.x.f.',**O),C('c.f.u.c.',**O),C('c.cc.cc.',**O),C('x.c.cc..',**O),C('c.cc.cc.',**O)]),
            ( 'S',[C('c.c.u.c.',**O),C('cc.cc.c.',**O),C('c.f.cc.c',**O),C('x.c.cc..',**O),C('c.cc.cc.',**O),C('u.c.cc..',**O),C('cc.cc.c.',**O)])])
# 9: everything mixed (shaman) — 1.6/s
S[8]=fit(8,[( 'S',[C('c.x.u...'),C('q==.c.x.'),C('u.c.c...'),C('c...u.x.'),C('c.c.c.c.',tag='{habit}',ans='T.t.T.t.'),C('c.f.u.x.'),C('x...u.c.')]),
            ( 'K',[C('c.x.c...',tag='{bpm:1.08}{say:주문이 빨라진다!}'),C('u.c.u...'),C('c.c.x.u.'),C('q==.c.x.'),C('x.u.c.c.'),C('c.u.x.c.'),C('c.c.u.c.')]),
            ( 'S',[C('c.x.u.c.'),C('x.c.c.u.'),C('c.c.x.c.'),C('u.c.x.c.'),C('c.c.c.x.'),SELF('p.p.p.p.'),SELF('p.p.j...')])])
# 10: Goblin Chief boss — half-bar exchange, all of chapter 2 — 1.75/s
S[9]=fit(9,[( 'S',[SELF('cc.ctt.t'),SELF('cc.ctt.t'),SELF('cc.xtt.d'),SELF('cc.xtt.d'),SELF('cc.utt.j'),SELF('cc.uTT.J')]),
            ( {'m':'G','tag':'{fx:-}'},[C('x.x.c.c.',tag='{fx:mirror}'),C('x.x.c.c.'),C('x.x.c.c.',hide=True),C('cc.x.cc.'),C('cc.x.cc.'),C('cc.x.cc.',hide=True)]),
            ( 'K',[C('cc.cc...',shift=1),C('c.f.u.c.',shift=1),C('cc.c.x..',shift=1),C('cc.c.x..',shift=1,hide=True),C('cc.cc.c.',shift=1),C('c.cc.u..',shift=1)]),
            ( 'S',[C('q==.c.u.',tag='{bpm:0.85}{say:대장이 숨을 고른다…}'),C('cc.c.x..'),C('q==.c.x.'),C('cc.c.u..'),SELF('i.p.p.p.'),SELF('p.p...d.')]),
            ( {'m':'S','tag':'{fx:-}'},[C('c.x.c.x.',tag='{bpm:1.12}{fx:mirror}{say:대장이 폭주한다! 빨라진다!}'),C('cc.c.x..'),C('cc.cc.c.'),C('cccc.cc.'),C('cc.cc.x.'),C('cc.x.cc.'),C('q==.c.x.'),C('cc.c.u..'),C('cc.c.u..',hide=True),SELF('cc.ctt.t'),SELF('cc.cTT.T')])])
def check(k,bars):
    seq=[]
    for bi,b in enumerate(bars):
        x=b
        while x.startswith('{'): x=x[x.index('}')+1:]
        h=x.split('/')[1] if '/' in x else ('' if x[:2] in('S:','G:','K:') or x in('R','E','S','G','K') else x)
        if len(h)!=8: continue
        for i,ch in enumerate(h):
            if ch in 'tThHdDjJ': seq.append((bi*8+i,ch))
    for a,b2 in zip(seq,seq[1:]):
        if (a[1] in 'dDjJ' or b2[1] in 'dDjJ') and b2[0]-a[0]<2: raise SystemExit(f'stage {k+1}: swipe/jump too close at bar {a[0]//8} {a} {b2}')
for k,v in S.items(): check(k,v)
json.dump({k:v for k,v in S.items()},open(sys.argv[1],'w'),ensure_ascii=False)
for k,v in S.items(): print(k+1,len(v),'bars','density %.2f target %.2f'%(density(v,BPM[k]),target(k)))
