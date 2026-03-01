import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';

export function json(res: ServerResponse<IncomingMessage>, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

export function text(
  res: ServerResponse<IncomingMessage>,
  statusCode: number,
  body: string,
  contentType = 'text/plain; charset=utf-8',
  extraHeaders: Record<string, string> = {},
): void {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

export async function readFixture(fileName: string): Promise<string> {
  return readFile(join(process.cwd(), 'tests', 'Fixtures', fileName), 'utf8');
}

export async function readExtensionAsset(fileName: string): Promise<Buffer> {
  return readFile(join(process.cwd(), 'extension', fileName));
}

export function extToContentType(fileName: string): string {
  const ext = extname(fileName).toLowerCase();
  if (ext === '.js') {
    return 'application/javascript; charset=utf-8';
  }
  if (ext === '.css') {
    return 'text/css; charset=utf-8';
  }
  if (ext === '.json') {
    return 'application/json; charset=utf-8';
  }
  return 'application/octet-stream';
}
