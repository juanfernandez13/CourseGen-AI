import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    serverFallbackAvailable: !!process.env.GEMINI_KEY,
    // Decide se o browser envia os arquivos direto ao Blob ou para as rotas.
    blobEnabled: !!process.env.BLOB_READ_WRITE_TOKEN,
  });
}
