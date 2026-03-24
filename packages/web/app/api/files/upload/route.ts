import { NextRequest } from 'next/server';

const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:3000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? '';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';

  let upstream: Response;
  try {
    upstream = await fetch(`${ENGINE_URL}/api/v1/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENGINE_API_KEY}`,
        'Content-Type': contentType,
      },
      body: req.body,
      // @ts-expect-error — Node 20 fetch needs duplex for streaming request body
      duplex: 'half',
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Engine unreachable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
