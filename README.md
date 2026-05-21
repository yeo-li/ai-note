# AI Note

AI Note 저장소는 `npm workspaces` 기반 모노레포로 정리되어 있으며, 현재는 데스크톱 앱이 먼저 연결되어 있습니다.

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

루트 명령은 현재 `apps/desktop` 워크스페이스로 위임됩니다. 따라서 최소 검증 명령인 `npm run build:renderer`도 계속 루트에서 그대로 실행할 수 있습니다.

AI 기능은 Electron main process에서 Gemini API를 직접 호출합니다. 실행 환경에 `API_KEY`를 설정하면 기본 API provider가 메모 정리, 문맥 검색, 메모 조합에 사용됩니다.

```bash
API_KEY=your_api_key npm run dev
```

기본 모델은 `gemini-2.5-flash`이며, 필요하면 `AI_NOTE_AI_MODEL`로 바꿀 수 있습니다.

```bash
API_KEY=your_api_key AI_NOTE_AI_MODEL=gemini-2.5-pro npm run dev
```

네트워크 호출 없이 로컬 정리 provider만 확인하려면 `AI_NOTE_ORGANIZE_PROVIDER=local`을 함께 설정할 수 있습니다.

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
- `better-sqlite3`는 네이티브 모듈이라 Node 테스트와 Electron 실행의 ABI가 다릅니다. `npm test`는 Node용으로, `npm start`/`npm run dev:desktop`은 Electron용으로 자동 재빌드합니다.
- visual snapshot baseline은 OS별로 관리되며, 현재 OS의 baseline이 없으면 visual spec은 자동으로 skip 됩니다.
- 현재 OS baseline을 만들거나 갱신할 때는 `npm run test:e2e:update`를 사용합니다.
- Electron E2E는 GUI가 가능한 로컬 데스크톱 환경에서 실행하는 편이 안전합니다.
- Allure HTML 생성은 로컬 Java 런타임이 필요할 수 있습니다.

## 구조

- `apps/desktop/`: Electron main/preload, React renderer, Playwright E2E를 포함한 현재 실행 앱
- `apps/server/`: 이후 서버/API 이슈를 위한 워크스페이스 자리
- `packages/shared/`: 공용 타입/계약/유틸리티 수용 자리
- 루트 `package.json`: workspace 선언과 공통 명령 위임

## 요구사항 문서

- `docs/mvp-requirements.md`: 현재 프로젝트의 MVP 요구사항, 범위, acceptance criteria, 구현 순서
- `docs/github-task-backlog.md`: GitHub 이슈로 쪼개기 위한 초기 백로그와 워크트리 분할 기준
- `docs/engineering-workflow.md`: develop 중심 브랜치 전략, 모노레포/worktree 운영 규칙, PR 기준
- `docs/issue-driven-development-rules.md`: 이슈 생성부터 브랜치/커밋/PR까지의 이슈 기반 개발 기본 운영 규칙
- `docs/sprint-1-acceptance-smoke.md`: Sprint 1 수용 기준과 데스크톱 smoke 시나리오
