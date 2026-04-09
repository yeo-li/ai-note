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
