/**
 * Ajustes de comportamento do Relatório de Triagem — 1º grau (Varas do Trabalho).
 * Altere aqui (e não espalhado pelo código). Depois rode `npm run build`.
 */
export const CONFIG = Object.freeze({
  VERSAO: '1.0.0-vt',

  // Caixa do Painel Global do PJe 1º grau. Descoberto no TRT-16 (2ª VT de São Luís):
  // "Minutar Despacho" = agrupamento 16 (no 2º grau, a Triagem é o 12).
  // Caixa padrão (usada quando o script é colado no Console, sem botão).
  AGRUPAMENTO: 16,
  NOME_CAIXA: 'Minutar Despacho',

  // Um botão (favorito) para cada caixa da página de instalação.
  // Números conferidos no TRT-16 em 07/11/2026 (GET /agrupamentotarefas/{id}).
  CAIXAS: [
    { id: 16, nome: 'Minutar Despacho' },
    { id: 9, nome: 'Minutar Sentença' },
    { id: 14, nome: 'Prazos Vencidos' },
    { id: 8, nome: 'Análises' },
    { id: 5, nome: 'Comunicação e Expedientes' }
  ],

  // A lista vem em páginas: a 1ª sozinha (diz quantas são), as demais em paralelo.
  TAMANHO_PAGINA_LISTAGEM: 100,
  TEMPO_LIMITE_LISTAGEM_MS: 120000,

  // false = todos os processos da caixa (o responsável aparece na ficha).
  SOMENTE_SEM_RESPONSAVEL: false,

  // Busca a descrição da prioridade legal (idoso, doença grave etc.) quando o PJe indica uma.
  BUSCAR_PRIORIDADES: true,

  // Processos baixados ao mesmo tempo (cada um faz 3 ou 4 requisições).
  // Se o PJe responder "muitas requisições" (429), o número cai pela metade sozinho.
  CONCORRENCIA: 10,
  CONCORRENCIA_MINIMA: 2,

  TENTATIVAS: 3,
  ESPERA_BASE_MS: 500,
  TEMPO_LIMITE_REQUISICAO_MS: 30000,

  // Faixas de tempo na caixa (em dias), usadas no panorama.
  FAIXAS_DIAS: [30, 60, 90, 120, 180],

  // Endereço publicado do gerador (o favorito só carrega este arquivo).
  URL_SCRIPT: 'https://delanoalmeida-bit.github.io/relatorio-caixas-pje/relatorio.js'
});
