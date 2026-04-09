# AI Note Desktop

macOS와 Windows용 데스크톱 애플리케이션을 시작할 수 있도록 만든 초기 골격입니다.

## Stack

- Electron
- React
- TypeScript
- Vite
- electron-builder

## Start

```bash
npm install
npm run dev
```

## Build

```bash
npm run dist:mac
npm run dist:win
```

Windows 설치 파일은 보통 Windows 러너가 있는 CI에서 만드는 편이 더 안정적입니다.

## Structure

- `electron/`: main process / preload
- `src/`: renderer UI
- `vite.config.ts`: renderer build setup
- `package.json`: dev/build/package scripts

## Requirements

- `docs/mvp-requirements.md`: 현재 프로젝트의 MVP 요구사항, 범위, acceptance criteria, 구현 순서
- `docs/github-task-backlog.md`: GitHub 이슈로 쪼개기 위한 초기 백로그와 워크트리 분할 기준
- `docs/engineering-workflow.md`: main 중심 브랜치 전략, 스프린트 운영 규칙, Codex 워킹트리 분할 기준
- `docs/sprint-1-acceptance-smoke.md`: Sprint 1 수용 기준과 데스크톱 smoke 시나리오
