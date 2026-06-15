export const defaultMemoServerUrl = "http://127.0.0.1:4310";

export class MemoServerError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "MemoServerError";
    this.status = status;
  }
}

function buildMemosUrl(baseUrl, path = "") {
  return `${baseUrl.replace(/\/+$/u, "")}/api/memos${path}`;
}

async function requestJson(request, url, init) {
  const response = await request(url, init);

  if (!response.ok) {
    throw new MemoServerError(`메모 서버 요청에 실패했어요. (${response.status})`, response.status);
  }

  return response.json();
}

export function createMemoServerClient({ baseUrl = defaultMemoServerUrl, request = fetch } = {}) {
  return {
    async list() {
      const { memos } = await requestJson(request, buildMemosUrl(baseUrl));
      return memos;
    },

    async get(memoId) {
      const { memo } = await requestJson(request, buildMemosUrl(baseUrl, `/${encodeURIComponent(memoId)}`));
      return memo;
    },

    async create(input) {
      const { memo } = await requestJson(request, buildMemosUrl(baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });
      return memo;
    },

    async upsert(memoId, memo) {
      const { memo: upserted } = await requestJson(request, buildMemosUrl(baseUrl, `/${encodeURIComponent(memoId)}`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(memo)
      });
      return upserted;
    },

    async update(memoId, patch) {
      const { memo } = await requestJson(request, buildMemosUrl(baseUrl, `/${encodeURIComponent(memoId)}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });
      return memo;
    },

    async delete(memoId) {
      const { deleted } = await requestJson(request, buildMemosUrl(baseUrl, `/${encodeURIComponent(memoId)}`), {
        method: "DELETE"
      });
      return deleted;
    }
  };
}
