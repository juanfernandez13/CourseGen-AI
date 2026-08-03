export function lerPlanilha(buffer: Buffer, filename?: string): Promise<string[][]>;
export function planilhaParaTexto(rows: string[][]): string;
export function parseCsv(text: string): string[][];

/** Assinatura OLE2: formato .xls do Excel 97-2003. */
export function ehXlsLegado(buffer: Buffer): boolean;

/** Assinatura ZIP: formato .xlsx (OOXML). */
export function ehXlsx(buffer: Buffer): boolean;
