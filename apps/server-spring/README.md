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

## 빌드 및 테스트

```bash
./gradlew build
./gradlew test
```
