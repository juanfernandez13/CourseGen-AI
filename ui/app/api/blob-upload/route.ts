import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/* Documentos de planejamento e anexos de tarefa. Restringir os tipos evita que
 * a rota vire um host de arquivos qualquer. */
const ALLOWED_CONTENT_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                      // .doc
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/octet-stream',
];

/* Não é um limite de produto: é uma trava contra esgotar a cota do plano Hobby,
 * que bloqueia o store por 30 dias quando estourada. */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Mesma regra de acesso das outras rotas: chave do usuário ou chave do servidor. */
function hasAccess(clientPayload: string | null): boolean {
  if (process.env.GEMINI_KEY?.trim()) return true;
  return !!clientPayload?.trim();
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Nenhum Blob store conectado a este ambiente.' },
      { status: 501 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!hasAccess(clientPayload)) {
          throw new Error('Configure a chave do Gemini antes de enviar arquivos.');
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          // Uploads são efêmeros; o sufixo evita colisão entre sessões.
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        /* Intencionalmente vazio. O cliente já recebe a URL de upload() e a
         * envia para /api/extract e /api/generate, que apagam os blobs quando
         * terminam. Este callback também não alcança o localhost. */
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
