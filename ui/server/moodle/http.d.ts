export { Sessao } from './index';

export declare class PoteDeCookies {
  constructor(serializado?: string);
  absorve(resposta: Response): void;
  readonly header: string;
  readonly vazio: boolean;
}
