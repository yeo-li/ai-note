/**
 * 로컬 메모 스토어를 단일 소스로 유지하면서, 모든 변경 사항을 Spring 서버로 푸시한다.
 * 서버 요청이 실패하면(오프라인 등) 변경 사항을 큐에 쌓아두고,
 * 다음 변경 시점 또는 flushQueue() 호출 시 재전송한다.
 *
 * list/get은 로컬 스토어를 그대로 사용한다. 서버 → 로컬 풀 동기화는 이후 작업 범위다.
 */
export function createMemoSyncStore({ memoStore, serverClient, queue }) {
  async function pushUpsert(memo) {
    await serverClient.upsert(memo.id, memo);
  }

  async function pushDelete(memoId) {
    await serverClient.delete(memoId);
  }

  async function flushQueue() {
    const operations = await queue.list();

    for (const operation of operations) {
      try {
        if (operation.type === "upsert") {
          await pushUpsert(operation.memo);
        } else if (operation.type === "delete") {
          await pushDelete(operation.memoId);
        }

        await queue.remove(operation.id);
      } catch {
        // 여전히 오프라인이거나 서버에 연결할 수 없으면 남은 작업은 다음 기회에 재시도한다.
        break;
      }
    }
  }

  async function syncUpsert(memo) {
    await flushQueue();

    try {
      await pushUpsert(memo);
    } catch {
      await queue.enqueueUpsert(memo);
    }
  }

  async function syncDelete(memoId) {
    await flushQueue();

    try {
      await pushDelete(memoId);
    } catch {
      await queue.enqueueDelete(memoId);
    }
  }

  return {
    ...memoStore,

    async create(input) {
      const memo = await memoStore.create(input);
      await syncUpsert(memo);
      return memo;
    },

    async update(memoId, updates) {
      const memo = await memoStore.update(memoId, updates);

      if (memo) {
        await syncUpsert(memo);
      }

      return memo;
    },

    async delete(memoId) {
      const deleted = await memoStore.delete(memoId);

      if (deleted) {
        await syncDelete(memoId);
      }

      return deleted;
    },

    flushQueue
  };
}
