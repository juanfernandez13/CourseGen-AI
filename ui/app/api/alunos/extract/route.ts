import { NextRequest, NextResponse } from 'next/server';
import { lerPlanilha } from '../../../../server/planilha';
import { extrairAlunos } from '../../../../server/alunos';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ACEITOS = /\.(xlsx|xls|csv)$/i;

function getApiKey(req: NextRequest): string | null {
  return req.headers.get('x-gemini-key')?.trim() || process.env.GEMINI_KEY?.trim() || null;
}

/* Planilha → registros normalizados. A resposta inclui os problemas de cada
 * linha para que a revisão aconteça antes de gerar o CSV. */
export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Configure a chave do Gemini nas configurações ou defina GEMINI_KEY no servidor.' },
      { status: 401 },
    );
  }

  try {
    const formData = await req.formData();
    const planilha = formData.get('planilha');

    if (!(planilha instanceof File)) {
      return NextResponse.json({ error: 'Envie uma planilha.' }, { status: 400 });
    }
    if (!ACEITOS.test(planilha.name)) {
      return NextResponse.json(
        { error: `${planilha.name}: use um arquivo .xlsx, .xls ou .csv.` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await planilha.arrayBuffer());
    const rows = await lerPlanilha(buffer, planilha.name);

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'A planilha não tem linhas de dados além do cabeçalho.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ alunos: await extrairAlunos(rows, apiKey) });
  } catch (error: unknown) {
    console.error('Falha ao interpretar a planilha de alunos:', error);
    const bruto = error instanceof Error ? error.message : '';

    // erro de formato já vem redigido para o usuário; repassar é melhor que
    // trocar por "não foi possível interpretar", que não diz o que fazer
    if (bruto.includes('Formato de planilha não reconhecido')) {
      return NextResponse.json({ error: bruto }, { status: 400 });
    }

    const mensagem = bruto.includes('429') || bruto.includes('RESOURCE_EXHAUSTED')
      ? 'O limite de uso do Gemini foi atingido. Tente novamente mais tarde.'
      : bruto.includes('504') || bruto.includes('DEADLINE_EXCEEDED')
      ? 'O Gemini demorou demais para responder. Tente de novo em instantes.'
      : bruto.includes('503') || bruto.includes('UNAVAILABLE')
        ? 'O Gemini está sobrecarregado agora. Aguarde alguns minutos e tente de novo.'
        : bruto.includes('API key') || bruto.includes('401') || bruto.includes('403')
          ? 'A chave do Gemini é inválida ou não tem permissão para usar o modelo.'
          : 'Não foi possível interpretar a planilha.';
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
