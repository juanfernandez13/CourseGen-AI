export type V2Stage =
  | 'home'
  | 'upload'
  | 'extracting'
  | 'review'
  | 'generating'
  | 'done'
  | 'error';

export type LogLine = {
  ts:    string;       // mm:ss
  tag:   string;       // 'parser' | 'gemini' | 'linker' | 'error'
  body:  string;
  tone?: 'info' | 'ok' | 'warn' | 'danger';
};

export type MatrizSummary = {
  nome?:   string;
  codigo?: string;
  carga?:  string;
  unidades?: number;
  atividades?: number;
};
