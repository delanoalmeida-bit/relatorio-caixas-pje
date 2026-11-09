# Relatório de caixas do PJe — 1º grau (Varas do Trabalho)

Um clique no PJe 1º grau e o navegador baixa um **PDF** com todos os processos de uma caixa do
Painel Global — começando pela **Minutar Despacho** (agrupamento 16, TRT-16).

Adaptação de [paulodca/relatoriodetriagem](https://github.com/paulodca/relatoriodetriagem) (PJe 2º grau).

## Instalar
Abra **https://delanoalmeida-bit.github.io/relatorio-caixas-pje/**, mostre a barra de favoritos
(`Ctrl+Shift+B`) e arraste o botão para ela. No PJe, logado, clique no favorito.

## Entradas de ontem (triagem diária)
Botão à parte (verde na página de instalação). Pergunta a data de início — o padrão é o último dia
útil, e na segunda-feira pega sexta a domingo — e baixa um `.md` só com os processos que entraram
na caixa no período e ainda estão nela: tabela para leitura e bloco JSON para o assistente de
triagem diária. O relatório completo não muda. Código em `src/entradas/`; divisão dos assistentes
pelo dígito final em `src/config.js` (`DIVISAO_ASSISTENTES`).

## Privacidade
Tudo roda no navegador, com a sessão do próprio usuário. Nenhum dado de processo sai do computador.
CPF, e-mail, telefone e endereço são descartados antes de montar o PDF; em segredo de justiça, as
partes não aparecem.

## Manutenção
- Código em `src/`, testes em `tests/` (`npm test`), empacotamento com `npm run build`
  (gera `docs/`, publicado pelo GitHub Pages, e `dist/relatorio-vt.txt` para colar no Console).
- Caixa, faixas de tempo e paralelismo: `src/config.js`.
- O que sai no PDF: `documentacao/CONTEUDO_DO_RELATORIO_VT.md`.
