import { NextRequest, NextResponse } from 'next/server';
import { previsualiza, confirma } from '../../../../server/moodle/uploaduser';
import { sessaoDoCookie, naoAutenticado } from '../../../lib/moodleServer';

export const runtime = 'nodejs';
export const maxDuration = 300;

/* Envia o CSV gerado para o "Carregar lista de usuários" do Moodle.
 *
 * `confirmar: false` (o padrão) sobe o arquivo e devolve a pré-visualização do
 * próprio Moodle — quem já existe, quem será criado — sem tocar em ninguém.
 * Só com `confirmar: true` os usuários são criados, e não há desfazer.
 *
 * A confirmação refaz o upload em vez de guardar o `iid` do passo anterior: o
 * iid aponta para um arquivo temporário no servidor e uma requisição depois já
 * pode ter expirado. O CSV é o mesmo, e a interpretação do Moodle é
 * determinística, então a prévia continua valendo. */
export async function POST(req: NextRequest) {
  const atual = await sessaoDoCookie();
  if (!atual) return naoAutenticado();

  try {
    const body = await req.json();
    const csv = typeof body?.csv === 'string' ? body.csv : '';
    const nomeArquivo = String(body?.nomeArquivo ?? 'alunos.csv');
    const confirmar = body?.confirmar === true;

    if (!csv.trim()) {
      return NextResponse.json({ error: 'Envie o conteúdo do CSV.' }, { status: 400 });
    }

    const previa = await previsualiza(atual.sessao, { csv, nomeArquivo });

    if (!confirmar) {
      return NextResponse.json({ confirmado: false, linhas: previa.linhas });
    }

    const resultado = await confirma(atual.sessao, previa.formulario, body?.opcoes ?? {});

    if (!resultado.ok) {
      return NextResponse.json(
        { error: `O Moodle recusou o envio: ${resultado.erro}` },
        { status: 422 },
      );
    }

    return NextResponse.json({
      confirmado: true,
      linhas: previa.linhas,
      resumo: resultado.resumo,
    });
  } catch (error: unknown) {
    console.error('Falha ao enviar a lista de usuários ao Moodle:', error);
    const mensagem = error instanceof Error ? error.message : 'Não foi possível enviar ao Moodle.';
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
