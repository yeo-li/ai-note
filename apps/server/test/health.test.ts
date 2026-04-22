import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';

import { getConfig } from '../src/config.js';
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

test('malformed request targets return 400 instead of throwing', async () => {
  const mockResponse = createMockResponse();

  handleRequest(
    { host: '127.0.0.1', port: 4310 },
    { headers: { host: 'bad host value' }, method: 'GET', url: 'http://[::::' },
    mockResponse.response,
  );

  assert.equal(mockResponse.read().statusCode, 400);
  assert.deepEqual(JSON.parse(mockResponse.read().body), {
    error: 'bad_request',
  });
});

test('getConfig uses Node built-in env loading for quoted values and inline comments', async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'ai-note-server-config-'));
  const envFilePath = path.join(tempDirectory, '.env');
  const previousHost = process.env.HOST;
  const previousPort = process.env.PORT;

  await writeFile(envFilePath, 'HOST="127.0.0.2"\nPORT=4311 # comment\n', 'utf8');
  delete process.env.HOST;
  delete process.env.PORT;

  try {
    assert.deepEqual(
      getConfig({
        env: process.env,
        envFilePath,
        loadEnvFile: true,
      }),
      {
        host: '127.0.0.2',
        port: 4311,
      },
    );
  } finally {
    if (previousHost === undefined) {
      delete process.env.HOST;
    } else {
      process.env.HOST = previousHost;
    }

    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }

    await rm(tempDirectory, { force: true, recursive: true });
  }
});
