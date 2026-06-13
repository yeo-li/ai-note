# Electron 프로젝트 개발 지침

## 목표

이 프로젝트는 **장기 유지보수성**, **AI 친화성**, **명확한 책임 분리**, **보안성**을 최우선으로 한다.

모든 코드는 다음 원칙을 반드시 따른다.

1. Main / Preload / Renderer의 책임을 절대 섞지 않는다.
2. Renderer는 브라우저 앱처럼 작성한다.
3. Electron API는 Main에서만 사용한다.
4. Renderer는 파일 시스템, OS API, Node API를 직접 호출하지 않는다.
5. 모든 기능은 Feature 단위로 구성한다.
6. AI가 생성한 코드도 반드시 아래 규칙을 따른다.
7. 코드 길이보다 읽기 쉬운 구조를 우선한다.

---

# 프로젝트 구조

```txt
src/
├── main/
│   ├── app/
│   ├── windows/
│   ├── ipc/
│   │   └── handlers/
│   ├── services/
│   └── types/
│
├── preload/
│   ├── index.ts
│   └── api/
│
├── renderer/
│   ├── app/
│   ├── pages/
│   ├── features/
│   └── shared/
│       ├── components/
│       ├── hooks/
│       ├── utils/
│       └── types/
│
└── shared/
    ├── ipc/
    └── types/
```

---

# Electron 계층 규칙

## Main Process

### 역할

- 앱 실행
- BrowserWindow 생성
- 파일 저장
- 파일 읽기
- OS 기능
- 알림
- Tray
- Menu
- IPC 처리

### 금지

- React 상태 관리
- DOM 접근
- 화면 렌더링
- UI 로직

---

## Preload

### 역할

Renderer에 필요한 API만 노출

### 허용

```ts
contextBridge.exposeInMainWorld(...)
```

### 금지

```ts
window.require(...)
```

```ts
window.fs = fs
```

```ts
window.ipcRenderer = ipcRenderer
```

Renderer에게 Raw API를 넘기지 않는다.

---

## Renderer

Renderer는 일반 React 앱처럼 작성한다.

### 허용

- 상태 관리
- UI
- 이벤트 처리
- API 호출

### 금지

```ts
import fs from "fs";
```

```ts
import path from "path";
```

```ts
import { ipcRenderer } from "electron";
```

Renderer는 Electron을 몰라야 한다.

---

# IPC 규칙

## 문자열 직접 작성 금지

### 금지

```ts
ipcRenderer.invoke("save-file")
```

### 허용

```ts
ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE)
```

---

## 채널 중앙 관리

```ts
export const IPC_CHANNELS = {
  FILE_SAVE: "file:save",
  FILE_READ: "file:read",
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",
} as const;
```

---

# Feature 기반 구조

## 금지

```txt
components/
hooks/
stores/
services/
```

기능별 코드가 여기저기 흩어지는 구조

---

## 허용

```txt
features/

  timer/
    components/
    hooks/
    api/
    store/
    types/

  settings/
    components/
    hooks/
    api/
    store/
    types/
```

기능별로 모든 코드가 모여 있어야 한다.

---

# React 규칙

## 컴포넌트 길이

최대 200줄

200줄이 넘어가면 분리 검토

---

## Hook 분리

### 금지

```tsx
function TimerPage() {
  // 상태 20개

  // useEffect 7개

  // 비즈니스 로직 200줄
}
```

---

### 허용

```tsx
function TimerPage() {
  const timer = useTimer();

  return (
    <TimerView
      timer={timer}
    />
  );
}
```

---

# 비즈니스 로직 규칙

컴포넌트 안에 비즈니스 로직 작성 금지

---

## 금지

```tsx
const onStart = () => {
  if (seconds > 0) {
    ...
  }
}
```

---

## 허용

```tsx
const timer = useTimer();
```

```ts
export function useTimer() {
  const start = () => {
    ...
  };

  return {
    start,
  };
}
```

---

# 타입 규칙

## any 금지

### 금지

```ts
const data: any
```

---

### 허용

```ts
interface Timer {
  id: string;
  duration: number;
}
```

---

# import 규칙

## 상대 경로 지옥 금지

### 금지

```ts
../../../components
```

---

### 허용

```ts
@/features/timer/components
```

---

# 상태 관리 규칙

## 서버 상태

TanStack Query 사용

---

## 클라이언트 상태

Zustand 사용

---

## props drilling 3단계 이상 금지

발생 시 상태 구조 재검토

---

# 파일 규칙

파일 하나의 책임만 가진다.

---

## 금지

```ts
timer.ts

- UI
- 상태
- 저장
- IPC
```

---

## 허용

```txt
timer.store.ts
timer.hook.ts
timer.api.ts
timer.types.ts
```

---

# 함수 규칙

## 함수 길이

30줄 이하 권장

50줄 초과 금지

---

## 함수명

동사로 시작

### 허용

```ts
loadSettings()
```

```ts
saveSettings()
```

```ts
startTimer()
```

---

### 금지

```ts
settings()
```

```ts
timer()
```

---

# 주석 규칙

무엇을 하는지 설명 금지

왜 하는지 설명

---

## 금지

```ts
// count 증가
count++;
```

---

## 허용

```ts
// 사용자 경험상 1초 지연 없이 즉시 반영
count++;
```

---

# AI 코드 생성 규칙

AI는 아래 순서로 생각한다.

1. 기능 요구사항 분석
2. Main / Preload / Renderer 책임 구분
3. Feature 구조 생성
4. 타입 정의
5. 상태 정의
6. IPC 설계
7. 구현
8. 리팩토링

---

# AI가 절대 하면 안 되는 것

❌ Renderer에서 Electron API 사용

❌ Renderer에서 파일 저장

❌ any 사용

❌ 거대한 컴포넌트 생성

❌ 거대한 Hook 생성

❌ 문자열 IPC 사용

❌ Feature 구조 무시

❌ Main Process에 UI 로직 작성

❌ 컴포넌트에 비즈니스 로직 작성

❌ 상대경로 지옥 생성

---

# 최종 목표

새로운 개발자가 프로젝트에 들어왔을 때

- 5분 안에 구조를 이해할 수 있어야 한다.
- 기능 위치를 바로 찾을 수 있어야 한다.
- AI가 생성한 코드와 사람이 작성한 코드의 품질 차이가 거의 없어야 한다.
- 기능 추가 시 기존 코드를 거의 수정하지 않아야 한다.
- Electron 보안 규칙을 위반하지 않아야 한다.

모든 코드는 "읽기 쉬움 > 짧음"을 우선한다.