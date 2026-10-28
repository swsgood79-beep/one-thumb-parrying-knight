#!/usr/bin/env bash
# PreToolUse hook for the Artifact tool: before the game page is published,
# run the automated play test. Exit 2 blocks the publish and feeds the failure back to Claude.
input=$(cat)
echo "$(date "+%F %T") hook fired" >> "$(dirname "$0")/.prepublish.log"
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
case "$file" in
  */one-thumb-parrying-knight/index.html) ;;
  *) exit 0 ;;                       # not the game page: nothing to check
esac
dir="$(cd "$(dirname "$0")/.." && pwd)"
out=$(cd "$dir" && timeout 840 node tests/game-test.js --regions 0-9 --runs 1 2>&1)
code=$?
if [ $code -ne 0 ]; then
  echo "게임 자동 테스트 실패 — 업로드를 막았어요. 버그를 고친 뒤 다시 올리세요." >&2
  printf '%s\n' "$out" | grep -E "FAIL|passed|FAILURES|\]" | tail -25 >&2
  exit 2
fi
echo "{\"systemMessage\": \"게임 자동 테스트 통과: $(printf '%s' "$out" | grep -E 'runs passed' | tail -1)\"}"
exit 0
