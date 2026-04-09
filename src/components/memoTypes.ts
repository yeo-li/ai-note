export type Memo = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const memoDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const memoId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `memo-${Math.random().toString(36).slice(2, 10)}`;
};

const nowIso = () => new Date().toISOString();

export const createMemo = (overrides: Partial<Memo> = {}): Memo => {
  const timestamp = overrides.createdAt ?? nowIso();

  return {
    id: overrides.id ?? memoId(),
    title: overrides.title ?? "Untitled memo",
    body: overrides.body ?? "",
    createdAt: timestamp,
    updatedAt: overrides.updatedAt ?? timestamp
  };
};

export const sortMemosByRecency = (memos: Memo[]) =>
  [...memos].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      Date.parse(right.createdAt) - Date.parse(left.createdAt)
  );

export const getMemoPreview = (body: string) => {
  const cleaned = body.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "No content yet";
  }

  return cleaned.length > 90 ? `${cleaned.slice(0, 90).trimEnd()}…` : cleaned;
};

export const formatMemoTimestamp = (iso: string) => {
  const timestamp = new Date(iso);

  if (Number.isNaN(timestamp.getTime())) {
    return "Just now";
  }

  return memoDateFormatter.format(timestamp);
};

export const getMemoSeed = () => {
  const base = new Date();
  const offset = (minutes: number) => new Date(base.getTime() - minutes * 60_000).toISOString();

  return [
    createMemo({
      title: "Today",
      body: "Call procurement after lunch.\nAsk for the revised timeline and keep the follow-up short.",
      createdAt: offset(90),
      updatedAt: offset(12)
    }),
    createMemo({
      title: "Professor email draft",
      body: "안녕하세요 교수님. 오늘 회의 내용을 정리해서 전달드립니다.\n말투를 더 공손하게 다듬고 싶습니다.",
      createdAt: offset(220),
      updatedAt: offset(35)
    }),
    createMemo({
      title: "Meeting capture",
      body: "Need a short summary of the rollout blockers and one clear next action per team.",
      createdAt: offset(360),
      updatedAt: offset(140)
    })
  ];
};
