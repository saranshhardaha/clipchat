import { NextRequest } from 'next/server';

const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:3000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? '';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let upstream: Response;
  try {
    upstream = await fetch(`${ENGINE_URL}/api/v1/files/${id}/content`, {
      headers: { 'Authorization': `Bearer ${ENGINE_API_KEY}` },
    });
  } catch {
    return new Response('Engine unreachable', { status: 503 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response('File not found', { status: upstream.status });
  }

  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4',
    'Accept-Ranges': 'bytes',
  };
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers['Content-Length'] = contentLength;

  return new Response(upstream.body, { status: 200, headers });
}
