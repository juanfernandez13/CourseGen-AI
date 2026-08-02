import { NextResponse } from 'next/server';
import { buildManualPrompt } from '../../../server/promptDoc';

export const runtime = 'nodejs';

/* Serve o mesmo prompt que a aplicação usa no Gemini, para quem prefere gerar o
 * JSON em outra IA e colar na revisão. */
export function GET() {
  try {
    return NextResponse.json(buildManualPrompt());
  } catch (error) {
    console.error('Falha ao montar o prompt de referência:', error);
    return NextResponse.json({ error: 'Não foi possível carregar o prompt.' }, { status: 500 });
  }
}
