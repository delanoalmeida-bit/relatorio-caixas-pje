# Relatório da caixa — PJe 1º grau (Varas do Trabalho)

Adaptação do `relatoriodetriagem` (2º grau, github.com/paulodca/relatoriodetriagem) para o 1º grau.
Primeira caixa: **Minutar Despacho** = agrupamento **16** do Painel Global (TRT-16, 2ª VT de São Luís,
descoberto em 07/11/2026). Para outra caixa, mude `AGRUPAMENTO` e `NOME_CAIXA` em `src/config.js`.

## Endpoints usados (conferidos no TRT-16)
- `PATCH /pje-comum-api/api/agrupamentotarefas/{n}/processos` (lista paginada; mesmo corpo do 2º grau)
- `GET /processos/id/{id}`, `/partes`, `/assuntos`
- `GET /processos/id/{id}/prioridades/descricao` (só quando a lista indica prioridade)

## Seções do PDF
1. Capa: caixa, vara, data, quantidades, há mais tempo na caixa.
2. Sumário (clicável) e marcadores.
3. Panorama: por fase, por tempo na caixa (faixas em `FAIXAS_DIAS`), por responsável, por tarefa,
   por classe e indicadores.
4. Prioridade legal.
5. Prazo expirado no PJe.
6. Por responsável (todos os processos de cada um; "Sem responsável" por último).
7. Ente público no processo (cadastro `orgaoPublico` do PJe + lista de nomes do projeto original).
8. Recuperação judicial ou massa falida (pelo nome da parte).
9. Sindicato.
10. Listagem por reclamada (2+ processos; sem segredo de justiça).
11. Lotes para despacho em bloco: mesma reclamada + mesma OAB do lado do trabalhador + **mesma fase**.
12. Ficha de cada processo, por ordem de entrada na caixa.
13. Processos não lidos.

## O que mudou em relação ao 2º grau
- Saíram as regras recursais (preparo, tempestividade, MPT, rótulos recorrente/recorrido).
- Entraram dados de gestão da caixa: fase, tarefa, dias na caixa, responsável, concluso a,
  prioridade, prazo expirado, comentário.
- Todos os processos da caixa entram (`SOMENTE_SEM_RESPONSAVEL: false`).
- LGPD: além do original, `pessoaJuridica` é reduzida a nome, nome fantasia, CNPJ, órgão público e
  tipo (o PJe manda CPF e nome do responsável legal da empresa).
- Polos com muitas partes mostram as 6 primeiras e "e mais N".
