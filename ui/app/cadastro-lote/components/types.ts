export type ProblemaAluno = { campo: string; mensagem: string };

export type Aluno = {
  password:   string;
  username:   string;
  firstname:  string;
  lastname:   string;
  email:      string;
  city:       string;
  course1:    string;
  type1:      1 | 2;
  problemas:  ProblemaAluno[];
  avisos:     ProblemaAluno[];
  observacao: string | null;
};
