import assert from "node:assert/strict";
import test from "node:test";
import { MemoServerError, createMemoServerClient } from "./memo-server-client.mjs";

function createResponse({ ok = true, status = 200, payload }) {
  return {
    ok,
    status,
    async json() {
      return payload;
    }
  };
}

test("list sends GET to /api/memos and returns memos", async () => {
  let requestUrl = "";
  let requestInit;
  const client = createMemoServerClient({
    baseUrl: "http://127.0.0.1:4310",
    request(url, init) {
      requestUrl = url;
      requestInit = init;
      return Promise.resolve(createResponse({ payload: { memos: [{ id: "memo-1" }] } }));
    }
  });

  const memos = await client.list();

  assert.equal(requestUrl, "http://127.0.0.1:4310/api/memos");
  assert.equal(requestInit, undefined);
  assert.deepEqual(memos, [{ id: "memo-1" }]);
});

test("get sends GET to /api/memos/:id and returns memo or null", async () => {
  let requestUrl = "";
  const client = createMemoServerClient({
    baseUrl: "http://127.0.0.1:4310",
    request(url) {
      requestUrl = url;
      return Promise.resolve(createResponse({ payload: { memo: null } }));
    }
  });

  const memo = await client.get("memo-1");

  assert.equal(requestUrl, "http://127.0.0.1:4310/api/memos/memo-1");
  assert.equal(memo, null);
});

test("create sends POST with JSON body and returns created memo", async () => {
  let requestUrl = "";
  let requestInit;
  const client = createMemoServerClient({
    baseUrl: "http://127.0.0.1:4310",
    request(url, init) {
      requestUrl = url;
      requestInit = init;
      return Promise.resolve(createResponse({ status: 201, payload: { memo: { id: "memo-1", title: "제목" } } }));
    }
  });

  const memo = await client.create({ title: "제목" });

  assert.equal(requestUrl, "http://127.0.0.1:4310/api/memos");
  assert.equal(requestInit.method, "POST");
  assert.deepEqual(JSON.parse(requestInit.body), { title: "제목" });
  assert.deepEqual(memo, { id: "memo-1", title: "제목" });
});

test("update sends PATCH with JSON body and returns updated memo", async () => {
  let requestUrl = "";
  let requestInit;
  const client = createMemoServerClient({
    baseUrl: "http://127.0.0.1:4310",
    request(url, init) {
      requestUrl = url;
      requestInit = init;
      return Promise.resolve(createResponse({ payload: { memo: { id: "memo-1", favorite: true } } }));
    }
  });

  const memo = await client.update("memo-1", { favorite: true });

  assert.equal(requestUrl, "http://127.0.0.1:4310/api/memos/memo-1");
  assert.equal(requestInit.method, "PATCH");
  assert.deepEqual(JSON.parse(requestInit.body), { favorite: true });
  assert.deepEqual(memo, { id: "memo-1", favorite: true });
});

test("delete sends DELETE and returns deleted flag", async () => {
  let requestUrl = "";
  let requestInit;
  const client = createMemoServerClient({
    baseUrl: "http://127.0.0.1:4310",
    request(url, init) {
      requestUrl = url;
      requestInit = init;
      return Promise.resolve(createResponse({ payload: { deleted: true, memoId: "memo-1" } }));
    }
  });

  const deleted = await client.delete("memo-1");

  assert.equal(requestUrl, "http://127.0.0.1:4310/api/memos/memo-1");
  assert.equal(requestInit.method, "DELETE");
  assert.equal(deleted, true);
});

test("throws MemoServerError when response is not ok", async () => {
  const client = createMemoServerClient({
    baseUrl: "http://127.0.0.1:4310",
    request() {
      return Promise.resolve(createResponse({ ok: false, status: 500, payload: {} }));
    }
  });

  await assert.rejects(client.list(), (error) => {
    assert.ok(error instanceof MemoServerError);
    assert.equal(error.status, 500);
    return true;
  });
});
