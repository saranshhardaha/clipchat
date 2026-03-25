import { NextRequest, NextResponse } from 'next/server';

const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:3000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? '';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const upstream = await fetch(
    `${ENGINE_URL}/api/v1/files?${searchParams.toString()}`,
    { headers: { Authorization: `Bearer ${ENGINE_API_KEY}` } }
  );
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
