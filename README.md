# AI Note Desktop

macOS와 Windows용 데스크톱 애플리케이션을 시작할 수 있도록 만든 초기 골격입니다.

## 기술 스택

- Electron
- React
- TypeScript
- Vite
- electron-builder

## 실행

```bash
npm install
npm run dev
```

## 한국어 미리보기

이 브랜치는 한국어 UI 미리보기 버전입니다.

- 메모 작성/수정/삭제
- AI 정리: 문장 다듬기, 공손한 문체 변환
- 문맥 검색: 자연어 질의로 관련 메모 목록 표시

## 테스트

```bash
npm test
```

## 빌드

```bash
npm run dist:mac
npm run dist:win
```

Windows 설치 파일은 보통 Windows 러너가 있는 CI에서 만드는 편이 더 안정적입니다.

## QA

Playwright 기반 Electron E2E, visual snapshot, Allure 리포트 기본 설정이 포함되어 있습니다.

```bash
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:visual
npm run test:e2e:update
npm run test:e2e:report
```

Allure 리포트 생성 및 열기:

```bash
npm run allure:generate
npm run allure:open
```

참고:

- E2E는 `npm run build:renderer` 후 dist 기반 Electron 앱을 직접 실행합니다.
- 실제 앱 실행 시 메모는 Electron main process의 로컬 SQLite(`userData/memos.db`)에 저장되어 앱 재시작 후에도 유지됩니다.
- 기존 `memos.json` 또는 레거시 `notes.json` 데이터가 있으면 첫 실행 시 SQLite로 자동 마이그레이션됩니다.
- visual snapshot baseline은 OS별로 관리되며, 현재 OS의 baseline이 없으면 visual spec은 자동으로 skip 됩니다.
- 현재 OS baseline을 만들거나 갱신할 때는 `npm run test:e2e:update`를 사용합니다.
- Electron E2E는 GUI가 가능한 로컬 데스크톱 환경에서 실행하는 편이 안전합니다.
- Allure HTML 생성은 로컬 Java 런타임이 필요할 수 있습니다.

## 구조

- `electron/`: main process / preload
- `electron/store/`: local JSON memo persistence and Node smoke tests
- `src/`: renderer UI
- `vite.config.ts`: renderer build setup
- `package.json`: dev/build/package scripts

## 요구사항 문서

- `docs/mvp-requirements.md`: 현재 프로젝트의 MVP 요구사항, 범위, acceptance criteria, 구현 순서
- `docs/github-task-backlog.md`: GitHub 이슈로 쪼개기 위한 초기 백로그와 워크트리 분할 기준
- `docs/engineering-workflow.md`: main 중심 브랜치 전략, 스프린트 운영 규칙, Codex 워킹트리 분할 기준
- `docs/issue-driven-development-rules.md`: 이슈 생성부터 브랜치/커밋/PR까지의 이슈 기반 개발 기본 운영 규칙
- `docs/sprint-1-acceptance-smoke.md`: Sprint 1 수용 기준과 데스크톱 smoke 시나리오
