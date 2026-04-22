export interface HealthResponse {
  service: 'ai-note-server';
  status: 'ok';
}

export function getHealthResponse(): HealthResponse {
  return {
    service: 'ai-note-server',
    status: 'ok',
  };
}
