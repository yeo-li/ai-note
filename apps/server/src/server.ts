import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

import type { AppConfig } from './config.js';
import { getHealthResponse } from './routes/health.js';

export interface RequestLike {
  headers: IncomingHttpHeaders;
  method?: string;
  url?: string;
}

export interface ResponseLike {
  end(chunk?: string): void;
  writeHead(statusCode: number, headers: Record<string, string>): ServerResponse | ResponseLike;
}

function respondJson(response: ResponseLike, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

export function handleRequest(
  config: AppConfig,
  request: RequestLike,
  response: ResponseLike,
): void {
  if (!request.method || !request.url) {
    respondJson(response, 400, { error: 'bad_request' });
    return;
  }

  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url, `http://${config.host}:${config.port}`);
  } catch {
    respondJson(response, 400, { error: 'bad_request' });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    respondJson(response, 200, getHealthResponse());
    return;
  }

  respondJson(response, 404, { error: 'not_found' });
}

export function createAppServer(config: AppConfig): Server {
  return createServer((request, response) => handleRequest(config, request, response));
}
