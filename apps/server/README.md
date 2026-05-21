# @ai-note/server

`#30` 범위에서 서버 워크스페이스를 독립 실행 가능한 최소 상태로 초기 구성했다.

## 제공 범위

- TypeScript 기반 Node HTTP 서버 엔트리
- `.env` 기반 기본 설정 로딩
- `GET /health` 헬스체크 API
- 로컬 `dev/build/start/test` 스크립트

## 런타임 요구사항

- Node.js `20.12.0` 이상

## 로컬 실행

```bash
cp apps/server/.env.example apps/server/.env
npm run dev --workspace @ai-note/server
```

기본 주소:

```text
http://127.0.0.1:4310/health
```

빌드 및 실행:

```bash
npm run build --workspace @ai-note/server
npm run start --workspace @ai-note/server
```

테스트:

```bash
npm run test --workspace @ai-note/server
```

## 후속 이슈로 남기는 범위

- 메모 CRUD API
- AI organize API
- search API
- desktop 연동
- 인증/배포/운영 인프라
