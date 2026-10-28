#!/usr/bin/env bash
# PostToolUse hook for the Artifact tool: after the game page is published,
# remind Claude to show the user captioned screenshots of what was added.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  */one-thumb-parrying-knight/index.html) ;;
  *) exit 0 ;;
esac
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"사용자 요청(상시 규칙): 게임 업데이트를 올린 뒤에는 이번에 추가·변경한 화면을 Playwright로 캡처하고, node tools/showcase.js showcase/<버전>.png \"제목\" 이미지 \"설명\" ... 으로 설명이 붙은 이미지를 만들어 SendUserFile로 보여줄 것."}}
JSON
