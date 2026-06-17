# server-spring

Java/Spring Boot 기반 AI Note 백엔드 서버.

## 요구사항

- Java 21 이상

## 로컬 실행

H2 인메모리 DB를 사용하는 `local` 프로파일로 실행합니다.

```bash
cd apps/server-spring
./gradlew bootRun --args='--spring.profiles.active=local'
```

기본 주소:

```text
http://127.0.0.1:4310/health
```

환경변수 `HOST`, `PORT`로 주소를 변경할 수 있습니다.

## 프로덕션 실행

외부 DB를 사용할 때는 환경변수로 datasource를 지정합니다.

```bash
export SPRING_DATASOURCE_URL=jdbc:postgresql://host:5432/ai-note
export SPRING_DATASOURCE_USERNAME=user
export SPRING_DATASOURCE_PASSWORD=secret
export SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver
java -jar build/libs/server-spring.jar
```

## API

### 메모

- `GET /api/memos`: 메모 목록 조회
- `GET /api/memos/{memoId}`: 메모 단건 조회 (없으면 `{ "memo": null }`)
- `POST /api/memos`: 메모 생성 (`title`, `body`, `category`, `color`)
- `PATCH /api/memos/{memoId}`: 메모 부분 수정 (`title`, `body`, `favorite`, `category`, `color`)
- `PUT /api/memos/{memoId}`: 메모 업서트 (`title`, `body`, `favorite`, `category`, `color`, `createdAt`, `updatedAt`). 오프라인 동기화를 위한 엔드포인트로, `updatedAt` 기준 Last-Write-Wins로 충돌을 해소합니다. 서버 데이터가 더 최신이면 요청을 무시하고 기존 메모를 그대로 반환합니다.
- `DELETE /api/memos/{memoId}`: 메모 삭제

데이터는 H2 인메모리 DB에 저장되며, 서버를 재시작하면 초기화됩니다.

## 빌드 및 테스트

```bash
./gradlew build
./gradlew test
```
