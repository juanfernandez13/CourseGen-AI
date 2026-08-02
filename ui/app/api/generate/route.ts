import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { generateMBZ } from '../../../server/mbzGenerator';
import { mapTaskFiles } from '../../../server/taskFileMapper';
import { discardBlobs, downloadToTmp, isRemoteFile, type RemoteFile } from '../../../server/blobStore';

export const runtime = 'nodejs';
export const maxDuration = 300;

type TarefaFile = { filePath: string; filename: string };

type Inputs = {
  matrizJsonRaw: string | null;
  tarefas: TarefaFile[];
  /** URLs a apagar do storage depois da geração. */
  blobUrls: string[];
};

/** Anexos chegam como URLs do Blob (Vercel) ou como o arquivo em si (local). */
async function collectInputs(req: NextRequest): Promise<Inputs> {
  const isJson = req.headers.get('content-type')?.includes('application/json');

  if (isJson) {
    const body = await req.json();
    const remote: RemoteFile[] = Array.isArray(body?.tarefas) ? body.tarefas.filter(isRemoteFile) : [];
    return {
      matrizJsonRaw: typeof body?.matrizJson === 'string' ? body.matrizJson : null,
      tarefas: await Promise.all(
        remote.map(async file => ({
          filePath: await downloadToTmp(file, 'tarefa'),
          filename: file.name,
        })),
      ),
      blobUrls: remote.map(file => file.url),
    };
  }

  const formData = await req.formData();
  const entries = formData.getAll('tarefas').filter((e): e is File => e instanceof File);
  const tarefas: TarefaFile[] = [];
  for (const file of entries) {
    const filePath = path.join(os.tmpdir(), `tarefa_${Date.now()}_${file.name}`);
    fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
    tarefas.push({ filePath, filename: file.name });
  }

  return {
    matrizJsonRaw: formData.get('matrizJson') as string | null,
    tarefas,
    blobUrls: [],
  };
}

/** Respostas acima de 4.5 MB só passam pela Vercel em streaming, e um curso com
 * anexos ultrapassa isso com facilidade. O arquivo é removido ao fim do envio. */
function streamAndCleanup(mbzPath: string, filename: string): Response {
  const fileStream = fs.createReadStream(mbzPath);
  fileStream.on('close', () => fs.rm(mbzPath, { force: true }, () => {}));

  return new Response(Readable.toWeb(fileStream) as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(fs.statSync(mbzPath).size),
    },
  });
}

export async function POST(req: NextRequest) {
  let inputs: Inputs = { matrizJsonRaw: null, tarefas: [], blobUrls: [] };

  try {
    inputs = await collectInputs(req);

    if (!inputs.matrizJsonRaw) {
      return NextResponse.json({ error: 'matrizJson não enviado.' }, { status: 400 });
    }

    let matrizData: Record<string, unknown>;
    try {
      matrizData = JSON.parse(inputs.matrizJsonRaw);
    } catch (e: unknown) {
      return NextResponse.json({ error: `JSON inválido: ${e instanceof Error ? e.message : e}` }, { status: 400 });
    }

    const tarefaFilesMap = mapTaskFiles(inputs.tarefas);
    let tarefaCounter = 0;
    for (const aula of (matrizData.aulas as Array<Record<string, unknown>>) || []) {
      if (aula.tarefa) {
        tarefaCounter++;
        if (tarefaFilesMap[tarefaCounter]) {
          (aula.tarefa as Record<string, unknown>).arquivos = tarefaFilesMap[tarefaCounter];
        }
      }
    }

    const mbzPath = await generateMBZ(matrizData);
    const filename = `curso_${(matrizData.disciplina as Record<string, unknown>)?.codigo || 'moodle'}.mbz`;
    return streamAndCleanup(mbzPath, filename);
  } catch (error: unknown) {
    console.error('Falha ao gerar o MBZ:', error);
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o pacote.';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Os anexos já foram embutidos no pacote; o .mbz é limpo junto com o stream.
    for (const tarefa of inputs.tarefas) fs.rm(tarefa.filePath, { force: true }, () => {});
    await discardBlobs(inputs.blobUrls);
  }
}
