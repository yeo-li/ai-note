import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDirectory, '..');
const defaultEnvFilePath = path.resolve(workspaceRoot, '.env');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4310;

export interface AppConfig {
  host: string;
  port: number;
}

export interface GetConfigOptions {
  env?: NodeJS.ProcessEnv;
  envFilePath?: string;
  loadEnvFile?: boolean;
}

function loadEnvFileIfPresent(envFilePath: string): void {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  process.loadEnvFile(envFilePath);
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

export function getConfig(options: GetConfigOptions = {}): AppConfig {
  const {
    env = process.env,
    envFilePath = defaultEnvFilePath,
    loadEnvFile = env === process.env,
  } = options;

  if (loadEnvFile) {
    loadEnvFileIfPresent(envFilePath);
  }

  const host = env.HOST?.trim() || DEFAULT_HOST;

  return {
    host,
    port: readPort(env.PORT),
  };
}
