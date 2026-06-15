# server-spring

Java/Spring Boot 기반 AI Note 백엔드 서버.

## 요구사항

- Java 21 이상

## 로컬 실행

```bash
cd apps/server-spring
./gradlew bootRun
```

기본 주소:

```text
http://127.0.0.1:4310/health
```

환경변수 `HOST`, `PORT`로 주소를 변경할 수 있습니다.

## API

### 메모

- `GET /api/memos`: 메모 목록 조회
- `GET /api/memos/{memoId}`: 메모 단건 조회 (없으면 `{ "memo": null }`)
- `POST /api/memos`: 메모 생성 (`title`, `body`, `category`, `color`)
- `PATCH /api/memos/{memoId}`: 메모 부분 수정 (`title`, `body`, `favorite`, `category`, `color`)
- `DELETE /api/memos/{memoId}`: 메모 삭제

데이터는 H2 인메모리 DB에 저장되며, 서버를 재시작하면 초기화됩니다.

## 빌드 및 테스트

```bash
./gradlew build
./gradlew test
```
