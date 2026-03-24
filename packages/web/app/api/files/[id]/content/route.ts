import { NextRequest } from 'next/server';

const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:3000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? '';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const headers: Record<string, string> = { 'Authorization': `Bearer ${ENGINE_API_KEY}` };
  const range = req.headers.get('Range');
  if (range) headers['Range'] = range;

  let upstream: Response;
  try {
    upstream = await fetch(`${ENGINE_URL}/api/v1/files/${id}/content`, { headers });
  } catch {
    return new Response('Engine unreachable', { status: 503 });
  }

  if (!upstream.body) {
    return new Response('File not found', { status: upstream.status });
  }

  const responseHeaders = new Headers();
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const v = upstream.headers.get(h);
    if (v) responseHeaders.set(h, v);
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
