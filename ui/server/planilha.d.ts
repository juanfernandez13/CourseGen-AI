export function lerPlanilha(buffer: Buffer, filename: string): Promise<string[][]>;
export function planilhaParaTexto(rows: string[][]): string;
export function parseCsv(text: string): string[][];
