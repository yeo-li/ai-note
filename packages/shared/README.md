# @ai-note/shared

이 워크스페이스는 desktop/server가 함께 참조하는 계약 전용 패키지다.

- `@ai-note/shared/memo`: 메모 도메인 타입과 입력/결과 모델
- `@ai-note/shared/memo-api`: 메모 API 요청/응답 DTO
- `@ai-note/shared`: 배럴 export

현재 범위에서는 renderer/store 구현 세부 타입은 포함하지 않는다.

- `MemoStoreHealth` 같은 preload/store 상태 타입은 desktop 로컬에 둔다.
- desktop과 server는 앱 내부 파일을 가리키지 말고 이 패키지로만 계약을 참조한다.
