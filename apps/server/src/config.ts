import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '..');
const envFilePath = path.resolve(workspaceRoot, '.env');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4310;

export interface AppConfig {
  host: string;
  port: number;
}

function applyEnvFile(targetEnv: NodeJS.ProcessEnv): void {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const fileContents = fs.readFileSync(envFilePath, 'utf8');

  for (const rawLine of fileContents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!targetEnv[key]) {
      targetEnv[key] = value;
    }
  }
}

function readPort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(value, 10);

  if (Number.isNaN(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  applyEnvFile(env);

  const host = env.HOST?.trim() || DEFAULT_HOST;

  return {
    host,
    port: readPort(env.PORT),
  };
}
