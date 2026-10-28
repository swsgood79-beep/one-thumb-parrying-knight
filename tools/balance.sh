#!/usr/bin/env bash
# Measures difficulty: per region win rate and average lowest HP for a bot of given accuracy.
# Usage: tools/balance.sh <skill> <runs>
sk=${1:-0.75}; runs=${2:-4}
node tests/game-test.js --regions 0-9 --runs "$runs" --skill "$sk" --stats ${COLLECTOR:+--collector} 2>&1 | grep '^\[지역' | python3 -c "
import sys,re,collections
w=collections.Counter();n=collections.Counter();hp=collections.defaultdict(list)
for l in sys.stdin:
  r=int(re.search(r'지역(\d+)',l).group(1));n[r]+=1;w[r]+='result=win' in l;hp[r].append(int(re.search(r'minHP=(\d+)',l).group(1)))
print('실력 $sk: '+'  '.join(f'지역{r} {w[r]}/{n[r]} 체력{sum(hp[r])//len(hp[r])}%' for r in sorted(n)))"
