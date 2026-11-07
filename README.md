# Relatório de caixas do PJe — 1º grau (Varas do Trabalho)

Um clique no PJe 1º grau e o navegador baixa um **PDF** com todos os processos de uma caixa do
Painel Global — começando pela **Minutar Despacho** (agrupamento 16, TRT-16).

Adaptação de [paulodca/relatoriodetriagem](https://github.com/paulodca/relatoriodetriagem) (PJe 2º grau).

## Instalar
Abra **https://delanoalmeida-bit.github.io/relatorio-caixas-pje/**, mostre a barra de favoritos
(`Ctrl+Shift+B`) e arraste o botão para ela. No PJe, logado, clique no favorito.

## Privacidade
Tudo roda no navegador, com a sessão do próprio usuário. Nenhum dado de processo sai do computador.
CPF, e-mail, telefone e endereço são descartados antes de montar o PDF; em segredo de justiça, as
partes não aparecem.

## Manutenção
- Código em `src/`, testes em `tests/` (`npm test`), empacotamento com `npm run build`
  (gera `docs/`, publicado pelo GitHub Pages, e `dist/relatorio-vt.txt` para colar no Console).
- Caixa, faixas de tempo e paralelismo: `src/config.js`.
- O que sai no PDF: `documentacao/CONTEUDO_DO_RELATORIO_VT.md`.
