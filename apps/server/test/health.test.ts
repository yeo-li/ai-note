import assert from 'node:assert/strict';
import test from 'node:test';

import { handleRequest, type ResponseLike } from '../src/server.js';

function createMockResponse(): {
  read: () => { body: string; headers: Record<string, string>; statusCode: number };
  response: ResponseLike;
} {
  let statusCode = 0;
  let headers: Record<string, string> = {};
  let body = '';

  return {
    read: () => ({ body, headers, statusCode }),
    response: {
      end(chunk = '') {
        body += chunk;
      },
      writeHead(nextStatusCode, nextHeaders) {
        statusCode = nextStatusCode;
        headers = nextHeaders;
        return this;
      },
    },
  };
}

test('GET /health returns the server health payload', async () => {
  const mockResponse = createMockResponse();

  handleRequest(
    { host: '127.0.0.1', port: 4310 },
    { headers: {}, method: 'GET', url: '/health' },
    mockResponse.response,
  );

  assert.equal(mockResponse.read().statusCode, 200);
  assert.deepEqual(JSON.parse(mockResponse.read().body), {
    service: 'ai-note-server',
    status: 'ok',
  });
});

test('unknown routes return a JSON 404 response', async () => {
  const mockResponse = createMockResponse();

  handleRequest(
    { host: '127.0.0.1', port: 4310 },
    { headers: {}, method: 'GET', url: '/missing' },
    mockResponse.response,
  );

  assert.equal(mockResponse.read().statusCode, 404);
  assert.deepEqual(JSON.parse(mockResponse.read().body), {
    error: 'not_found',
  });
});
