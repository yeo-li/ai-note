# AI 채팅 화면 UI 리팩토링 명세서

## 1. 배경 및 목적

현재 AI 채팅창은 사용자의 자연어 입력을 정규식으로 분석해 **검색 / 요약 / 생성** 세 가지 의도(`AiChatIntent`) 중 하나로 추론한다. 그러나 이 앱이 제공하는 AI 기능은 이 세 가지가 전부이며, 정규식 기반 추론은 다음과 같은 한계가 있다.

- 키워드가 섞인 문장에서 의도를 오분류할 수 있다. (예: "회의 메모 새로 정리해줘" → 요약/생성 키워드 충돌)
- 사용자는 자신이 어떤 기능을 호출하는지 명확히 인지하지 못한 채 요청한다.
- 추론 로직(`inferAiChatIntent` 및 부속 함수)이 도메인에 상주하며 유지보수 비용을 발생시킨다.

**목표**: 채팅 스레드(누적 결과·연계 흐름)는 그대로 유지하되, 입력창 좌측에 **의도 선택 컨트롤**을 추가하여 사용자가 명시적으로 기능을 고르도록 한다. 이를 통해 의도 분류 비용을 제거하고, 사용자의 명령 흐름과 정확도를 동시에 개선한다.

---

## 2. 현재 구조 (As-Is)

### 2.1 관련 파일

| 파일 | 역할 |
| --- | --- |
| `apps/desktop/src/components/AiChatPanel.tsx` | 채팅 패널 UI (헤더 / 스레드 / 입력창) |
| `apps/desktop/src/hooks/useAiChatController.ts` | 채팅 상태 관리 및 요청 오케스트레이션 |
| `apps/desktop/src/domain/ai-chat.ts` | 의도 추론, 메시지 타입, 요약 생성 등 도메인 로직 |
| `apps/desktop/src/styles.css` | `.ai-chat-*` 스타일 |

### 2.2 현재 데이터 흐름

```
사용자 입력(textarea)
  → submitAiChatPrompt(promptOverride?)
  → prepareAiChatPrompt: 사용자 메시지 추가, status="thinking"
  → answerAiChatPrompt
      → inferAiChatIntent(prompt)   ← 정규식 추론 (제거 대상)
      → intent별 분기
          · compose  → answerAiChatWithComposedMemo
          · summary  → answerAiChatWithSummary
          · search   → answerAiChatWithSearch
  → 결과를 aiChatMessages에 append
  → finally: status="idle"
```

### 2.3 패널 구성 (현재)

```
AiChatPanel
├─ AiChatHeader        (AI Chat / 메모와 대화하기 / 닫기)
├─ AiChatThread        (메시지 누적 렌더링)
└─ AiChatComposer      (textarea + 보내기 버튼)
```

> 참고: 기존 `AiChatSuggestions`(추천 칩)는 본 리팩토링 직전 작업에서 이미 제거되었다.

---

## 3. 변경 후 구조 (To-Be)

### 3.1 패널 구성 (변경)

```
AiChatPanel
├─ AiChatHeader
├─ AiChatThread
└─ AiChatComposer
   ├─ AiChatModeSelector   ← [신규] 입력창 좌측 의도 선택 컨트롤
   ├─ textarea
   └─ 보내기 버튼
```

`AiChatModeSelector`는 입력창(`.ai-chat-composer`) 내부 **좌측**에 배치되며, **검색 / 요약 / 생성** 세 가지 모드를 토글 형태로 노출한다.

### 3.2 의도 선택 모델

- 채팅 컨트롤러에 `aiChatMode` 상태를 추가한다. 타입은 기존 `AiChatIntent`("search" | "summary" | "compose")를 재사용한다.
- **기본값**: `"search"` (가장 빈번한 사용 패턴).
- **지속성**: 선택한 모드는 다음 요청에서도 유지된다(매 요청마다 초기화하지 않음). 같은 의도로 연속 질문하는 흐름을 지원한다.
- 모드는 패널이 열려 있는 동안 유지되며, 패널을 닫았다 열어도 직전 선택을 유지한다. (세션 영속화는 범위에서 제외)

### 3.3 의도 추론 제거

- `answerAiChatPrompt`는 더 이상 `inferAiChatIntent`를 호출하지 않고, **컨트롤러 상태의 `aiChatMode`를 직접 사용**해 분기한다.
- `domain/ai-chat.ts`의 다음 항목을 **제거**한다.
  - `inferAiChatIntent`
  - `readAiChatIntentSignals`
  - `resolveAiChatIntent`
  - `AiChatIntentSignals` 타입
- `AiChatIntent` 타입은 **유지**한다(모드 상태 타입으로 계속 사용).

---

## 4. 상세 요구사항

### 4.1 UI / UX

#### 모드 선택 컨트롤 (`AiChatModeSelector`)

- 세 개의 버튼(또는 세그먼트 토글)으로 구성한다.
  - **검색** — 관련 메모를 찾는다.
  - **요약** — 관련 메모를 찾아 핵심을 요약한다.
  - **생성** — 관련 메모를 근거로 새 메모 초안을 만든다.
- 현재 선택된 모드는 시각적으로 구분되는 활성 상태(`is-active`, `aria-pressed="true"`)를 가진다.
- 키보드 접근성: 각 버튼은 `type="button"`, 적절한 `aria-label` 또는 라벨 텍스트를 가진다.
- `isAiChatThinking` 동안에는 모드 변경 버튼을 `disabled` 처리한다.

#### 모드 연동 플레이스홀더

선택된 모드에 따라 textarea의 `placeholder`를 전환해 사용자가 해당 모드의 입력 방식을 직관적으로 이해하도록 한다.

| 모드 | placeholder 예시 |
| --- | --- |
| 검색 | `예: 계약 일정과 관련된 메모 찾아줘` |
| 요약 | `예: 이번 주 회의 내용을 핵심만 요약해줘` |
| 생성 | `예: 관련 메모를 모아 회고 초안을 만들어줘` |

#### 생성(compose) 모드 안내

생성 모드는 검색·요약과 성격이 다르다(관련 메모를 **근거로** 새 메모를 만든다). 버튼 레이블 또는 짧은 보조 문구로 이 차이를 전달한다. (예: 버튼 hover 시 title, 또는 모드 선택 시 입력창 상단 한 줄 안내)

### 4.2 동작 로직

- 사용자가 입력 후 전송(`보내기` 또는 `Enter`)하면, **현재 `aiChatMode` 값**으로 곧바로 해당 기능을 실행한다.
- 전송 흐름은 기존 `submitAiChatPrompt` → `prepareAiChatPrompt` → `answerAiChatPrompt`를 유지하되, 마지막 분기만 모드 기반으로 바꾼다.
- 채팅 스레드(`aiChatMessages`)의 누적·렌더링 구조와 메시지 종류별 카드(`search-results` / `summary` / `created-note` / `text` / `error`)는 **변경하지 않는다**.

### 4.3 연계 흐름 유지

- 검색·요약 결과 → 생성으로 이어지는 흐름을 끊지 않는다. 사용자는 결과를 본 뒤 모드를 "생성"으로 바꾸고 후속 요청을 이어갈 수 있다.
- (선택 사항, 권장) 요약 결과 카드 하단에 "이 내용으로 메모 생성" 버튼을 두어 모드 전환 없이 생성으로 연결하는 보조 동선을 제공할 수 있다. — 본 리팩토링 필수 범위에는 포함하지 않으며 후속 개선으로 분리한다.

---

## 5. 구현 작업 항목

### 5.1 컨트롤러 (`useAiChatController.ts`)

1. `useAiChatState`에 `aiChatMode` / `setAiChatMode` 상태 추가 (초기값 `"search"`).
2. 반환 객체에 `aiChatMode`, `setAiChatMode` 노출.
3. `answerAiChatPrompt`에서 `inferAiChatIntent(trimmedPrompt)` 호출을 `context.aiChatMode` 참조로 교체.
4. `domain/ai-chat.ts`에서 `inferAiChatIntent` import 제거.

### 5.2 도메인 (`domain/ai-chat.ts`)

1. `inferAiChatIntent`, `readAiChatIntentSignals`, `resolveAiChatIntent`, `AiChatIntentSignals` 제거.
2. `AiChatIntent` 타입 유지.
3. 제거된 함수에 대한 단위 테스트가 있다면 함께 정리.

### 5.3 UI (`components/AiChatPanel.tsx`)

1. `AiChatModeSelector` 컴포넌트 신규 작성 (CLAUDE.md 규칙: 단일 책임, 30줄 이하 함수).
2. `AiChatComposer`에 `aiChatMode`, `setAiChatMode` props 추가, 좌측에 `AiChatModeSelector` 배치.
3. textarea `placeholder`를 모드 기반으로 산출하는 헬퍼(`getComposerPlaceholder(mode)`) 추가.
4. `AiChatPanel`의 props 타입에 `aiChatMode`, `setAiChatMode` 추가하고 상위(`App.tsx`)에서 전달.

### 5.4 상위 연결 (`App.tsx`)

1. `useAiChatController`가 반환하는 `aiChatMode`, `setAiChatMode`를 구조 분해.
2. `<AiChatPanel>`에 전달.

### 5.5 스타일 (`styles.css`)

1. `.ai-chat-mode-selector` 및 버튼/활성 상태 스타일 추가. 색 토큰은 기존 팔레트(`--accent`, `--accent-soft`, `--surface-sunken`, `--hairline` 등)를 재사용한다.
2. `.ai-chat-composer` 레이아웃을 모드 셀렉터를 좌측에 수용하도록 조정.

---

## 6. 영향 범위 및 비범위

### 영향 받는 파일
- `apps/desktop/src/hooks/useAiChatController.ts`
- `apps/desktop/src/domain/ai-chat.ts`
- `apps/desktop/src/components/AiChatPanel.tsx`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/styles.css`

### 비범위 (이번 작업에서 제외)
- 메시지 카드 렌더링 구조 변경
- IPC / 저장소(`memo-repository`) 계층 변경
- 모드 선택값의 디스크 영속화
- 요약→생성 자동 연결 버튼(후속 개선으로 분리)

---

## 7. 수용 기준 (Acceptance Criteria)

1. 입력창 좌측에 검색/요약/생성 모드 선택 컨트롤이 보인다.
2. 모드를 선택하면 활성 상태가 시각적으로 구분되고, placeholder가 해당 모드에 맞게 바뀐다.
3. 입력 후 전송 시, 정규식 추론 없이 **선택한 모드**로 기능이 실행된다.
4. 선택한 모드는 다음 요청에서도 유지된다.
5. 채팅 스레드의 기존 결과 카드(검색/요약/생성/안내/오류) 렌더링이 그대로 동작한다.
6. `inferAiChatIntent` 및 관련 정규식 함수가 코드베이스에서 제거된다.
7. `isAiChatThinking` 동안 모드 변경과 전송이 비활성화된다.
8. `tsc --noEmit` 통과 및 기존 테스트 그린.
