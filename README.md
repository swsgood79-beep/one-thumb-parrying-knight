# 원썸 패링 나이트 (One-Thumb Parrying Knight)

방패 하나뿐인 싸구려 용사가 마왕에게 납치된 공주를 구하러 가는 한 손가락 패링 액션 게임.
빌드 없이 `index.html` 하나로 동작합니다 (브라우저에서 열기).

## 구성
- `index.html` — 게임 전체 (캔버스 픽셀아트 + Web Audio 칩튠)
- `strategy.html` — 인기 모바일 게임 분석 / 성장 전략 문서
- `tests/game-test.js` — Playwright 자동 플레이 테스트 (가상 시계 + 봇)
  - `node tests/game-test.js --regions 0-9 --runs 1`
- `tests/prepublish.sh` — 업로드 전에 테스트를 돌리는 Claude Code 훅
- `tools/balance.sh` — 지역별 승률·최저 체력 측정 (`tools/balance.sh 0.75 4`)
- `tools/showcase.js` — 업데이트 화면 설명 이미지 생성
- `tools/postpublish.sh`, `tools/claude-settings.json` — 훅 설정 (`~/.claude/settings.json`에 복사해 사용)
- `showcase/` — 버전별 업데이트 화면
