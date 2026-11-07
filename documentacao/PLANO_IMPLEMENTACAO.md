# Plano — fork `relatoriodetriagem`: 1 clique no PJe → PDF completo baixado

## Contexto
O `triagempje` (R&D\PROJETO_TRIAGEM) funciona, mas ninguém usa: o fluxo exige
bookmarklet → .txt → abrir PWA → carregar arquivo → navegar 4 abas/filtros. O usuário final
quer **um PDF para imprimir e consultar**. Decisões do usuário (2026-11-04):
- Sem interface/tabela/abas: o **PDF é o produto** e precisa ser **bem completo**.
- **Download automático** do PDF (sem janela de impressão).
- Lista de processos **ordenada por data de entrada na triagem**.
- Escopo de coleta igual ao de hoje (caixa Triagem, agrupamento 12, sem responsável).
- Coleta bem mais rápida (~400 processos).
- Nome do arquivo com OJ + data/hora. Fork em projeto novo.

Fato verificado: o PJe do TRT2 envia só `content-security-policy: frame-ancestors ...`, **sem
`script-src`/`connect-src`** (`curl -I https://pje.trt2.jus.br/pjekz/`, 2026-11-04). Portanto
um bookmarklet pode injetar `<script src="https://paulodca.github.io/...">`. A dúvida "a engine
nativa dá conta?" vira: dá conta, mas abriria diálogo; com download automático usamos
**jsPDF + jspdf-autotable** (maduros, rodam no navegador e no Node), embutidos no bundle.

## Arquitetura (nova pasta `R&D\RELATORIO_TRIAGEM\`, git próprio, repo `paulodca/relatoriodetriagem`)
GitHub não deixa forkar repo próprio na mesma conta → repo novo, copiando o motor.
O `PROJETO_TRIAGEM` fica intocado (só ganha uma linha no README apontando o sucessor).

```
RELATORIO_TRIAGEM/
  README.md                       # 3 passos, para leigo (escrito ANTES do código)
  docs/CONTEUDO_DO_RELATORIO.md   # o que sai em cada seção, editável pelo usuário
  src/config.js                   # constantes: AGRUPAMENTO=12, CONCORRENCIA, retries, filtro "sem responsável"
  src/coleta/coletor.js           # listagem + detalhes, pool paralelo, retry/backoff, repescagem
  src/coleta/sanitizacao_lgpd.js  # COPIADO de PROJETO_TRIAGEM/src/coleta
  src/motor/*                     # COPIADOS: hub_triagem.js, classificadores/*, heuristicas/correlacao_patrono_assunto.js, triagem/*
  src/relatorio/dados_relatorio.js# função pura: lote enriquecido → estrutura das seções (testável)
  src/relatorio/nome_arquivo.js   # sigla OJ + timestamp
  src/relatorio/pdf.js            # render jsPDF/autotable
  src/overlay/overlay.js          # caixa flutuante no PJe: progresso, ETA, erro, link "baixar de novo"
  src/main.js                     # orquestra: coletar → enriquecer → montar → salvar PDF
  vendor/ (jspdf.umd.min.js, jspdf.plugin.autotable.min.js — versões fixadas)
  build.mjs                       # esbuild --bundle --minify --format=iife → dist/relatorio.js
  dist/index.html                 # página de instalação: SÓ o botão arrastável + 3 passos
  tests/
```

**Reuso direto** (sem reescrever): `processarLoteTriagem`/`enriquecerProcesso`
(`src/hub_triagem.js`), `identificarClustersPatronoAssunto`, `diagnosticarPJsProcesso`,
`estruturarPartesERepresentantes`, `identificarSindicatos`, `analisarGapAutos`,
`classificarClasse`, `sanitizarParte/sanitizarPartesDict` (de `src/coleta/bookmarklet.js`),
lógica de "Concentração por Reclamada" e "Fazenda sem MPT" de
`src/relatorios/exportar_relatorio.js` (só a parte de dados; o HTML/iframe sai).
**Cortado**: Tabulator, PWA/sw.js, IndexedDB, abas, filtros, `.txt` como passo obrigatório,
`assuntos_tpu.json` (500 KB — só preenche `ramo`; `assuntoCompleto` da API já traz o caminho e
`ehExecucao` cai no casamento por nome; `classificarAssuntos` já tolera catálogo vazio).
`termos_fazenda.json` (12 KB) fica embutido.

**Bookmarklet = loader minúsculo** (não precisa reinstalar quando o código melhora):
```js
javascript:(function(){if(!/\.jus\.br$/.test(location.hostname))return alert('Abra no PJe');
var s=document.createElement('script');
s.src='https://paulodca.github.io/relatoriodetriagem/relatorio.js?v='+Date.now();
s.onerror=function(){alert('Não consegui carregar o gerador (rede ou bloqueio do tribunal).')};
document.body.appendChild(s)})()
```
(`alert` só aqui, antes de qualquer coisa; dentro do fluxo, mensagens vão no overlay.)

## Velocidade (hoje: 5 processos × 3 GETs em paralelo, sem retry, falha é descartada)
- Mantém os 3 GETs (`/processos/id/{id}` traz valor da causa, justiça gratuita, tutela,
  autuação, relator — necessários pro PDF "completo"); `partes` e `assuntos` indispensáveis.
- `CONCORRENCIA` 5 → **12 processos** (≈36 requests em voo), em `config.js`.
- Retry com backoff exponencial (0,5 s / 1 s / 2 s) em 429/5xx/erro de rede; se aparecer 429,
  o pool reduz pela metade (adaptativo).
- **Repescagem**: falhas vão para uma segunda passada serial no fim; o que ainda falhar aparece
  no PDF numa seção "Processos não lidos" (nunca some calado).
- Páginas da listagem (PATCH, `tamanhoPagina` 500) buscadas em paralelo após a 1ª.
- Overlay mostra `n/total`, velocidade e ETA. Número final de concorrência = **medido ao vivo**
  pelo usuário (não prometer); meta realista ≈ 15–30 s para 400.

## Conteúdo do PDF (A4, Helvetica, cabeçalho e "pág. X de Y" em todas as páginas)
Princípio (usuário, 2026-11-04): **sem filtro nenhum, o PDF tem de ser redundante** — o mesmo
processo aparece em todas as seções a que pertence — e **legível por LLM** (texto real
selecionável, formato "Rótulo: valor", nada de informação só em cor/ícone), para a pessoa
jogar o PDF na LLM preferida e pedir as análises que quiser.
**Fora** do relatório: Recuperação Judicial e Massa Falida (sem uso prático).

1. **Capa**: tribunal (hostname `pje.trt2` → TRT-2), OJ (`listagem.descricaoOrgaoJulgador`),
   data/hora de geração (também no corpo), critério ("Triagem, sem responsável"),
   totais lidos / falhas.
2. **Sumário clicável** (pág. 2): cada seção com nº de página e link interno.
3. **Resumo em números**: total; conhecimento × execução; por classe; Fazenda Pública;
   Fazenda sem MPT; sindicato; físicos migrados; segredo de justiça; nº de lotes.
4. **Fazenda Pública sem MPT** (retificar autuação) — CNJ, classe, partes.
5. **Processos físicos migrados** (verificar prevenção depois) — CNJ, classe, partes, ano do CNJ.
6. **Processos com sindicato** — CNJ, classe, partes, polo do sindicato.
7. **Listagem por reclamada**: cada reclamada (nome + CNPJs), com a lista dos seus processos
   (CNJ, classe, entrada, reclamante). Ordenada por quantidade de processos.
8. **Listagem por lote**: **mesma reclamada + mesma OAB do patrono** (critério novo, troca o
   atual "mesma OAB + mesmos assuntos" de `correlacao_patrono_assunto.js`); mostra os assuntos
   em comum quando houver. Sem nome de advogado (só "mesmo cadastro de OAB"), como hoje.
9. **Ficha geral de cada processo**, por data de entrada na triagem — bloco por processo:
   nº de ordem, CNJ, classe, fase, entrada na triagem, autuação, relator, recorrente(s) e
   recorrido(s) (rótulo contextual de polo já existente), **todos os assuntos cadastrados**
   (principal marcado), valor da causa, justiça gratuita, tutela/liminar, prioridade,
   e linha "Alertas:" por extenso (Fazenda sem MPT, físico, sindicato, lote nº X, segredo).
10. **Índice por CNJ** (ordem numérica) com link para a ficha de cada processo.
11. **Processos não lidos** (se houver).

Navegação: **sumário com links** (`doc.link`/`textWithLink` com `pageNumber`) + **marcadores
na barra lateral** do leitor de PDF (`doc.outline.add`) para cada seção. Técnica: reservar a
pág. 2 em branco, renderizar o resto anotando a página inicial de cada seção, voltar com
`doc.setPage(2)` e escrever o sumário. O índice por CNJ vem no fim, quando as páginas das
fichas já são conhecidas.
- **Segredo de justiça** (`listagem.segredoDeJustica`; 4 de 322 na amostra): nomes de partes
  substituídos por "SEGREDO DE JUSTIÇA" em todas as seções.
- Acentos: fontes padrão do jsPDF usam WinAnsi (cobre ã, ç, ª, º); evitar travessão "—" e
  aspas curvas no texto gerado (trocar por "-" e aspas retas) — item de teste.
- Volume esperado: ~400 fichas ≈ 60–100 páginas. Normal para PDF de consulta/LLM.

## Nome do arquivo
`relatorio_triagem_TRT2_9T-4C_2026-11-04_14h32.pdf` — regex
`/(\d+)ª\s*Turma.*Cadeira\s*(\d+)/i` sobre o OJ **mais frequente** do lote → `9T-4C`;
sem casar → slug do texto do OJ; mais de um OJ → `variosOJ`. Sem `:`/`/`. Hora local.
Salvo com `doc.save(nome)` (download direto). Opcional, discreto no overlay:
"baixar dados brutos (.txt)" para quem ainda usa o PWA antigo.

## Etapas de execução (conforme fluxo do usuário: plano aqui, implementação em outra sessão)
1. Backup 7z de `R&D\PROJETO_TRIAGEM` **fora** da pasta (ex.: `D:\backups\`).
2. Criar `R&D\RELATORIO_TRIAGEM\`, `git init`; escrever **README.md + docs/CONTEUDO_DO_RELATORIO.md**
   e validar com o usuário antes do código.
3. Copiar motor + sanitização; remover dependência do TPU; rodar os testes copiados
   (`node --test`) — devem continuar passando.
4. `dados_relatorio.js` + `nome_arquivo.js` (puros) com testes.
5. `pdf.js` (jsPDF/autotable vendorizados, versão fixada).
6. `coletor.js` (pool + retry + repescagem) e `overlay.js`; `main.js`; `build.mjs` (esbuild).
7. `dist/index.html` de instalação; publicar no GitHub Pages — **criar o repo público e dar
   push só com confirmação explícita do usuário** (ação externa).
8. Linha no README do `PROJETO_TRIAGEM` apontando o sucessor. CodeQL/Semgrep no repo novo.
Implementação delegável via opencode/DeepSeek (sessão Orquestrador), com revisão.

## Verificação
- **Local (sem navegador)**: `tests/relatorio_fixture.test.mjs` roda o pipeline sobre
  `PROJETO_TRIAGEM/triagem_completa_2026-09-16(1).txt` (322 processos reais, OJ "9ª Turma -
  Cadeira 4") e gera o PDF via jsPDF no Node; checar com PyMuPDF (`fitz`): todas as seções
  presentes, 322 fichas, ordem por `dataEntradaTarefa`, os 4 processos em segredo sem nome de
  parte, acentos legíveis, nome `..._9T-4C_...`, **links do sumário e do índice por CNJ
  apontando para a página certa** (`page.get_links()`) e **marcadores** (`doc.get_toc()`),
  texto extraível limpo (`page.get_text()` legível como entrada de LLM).
- Teste unitário do novo critério de lote (mesma reclamada + mesma OAB) contra a amostra.
- Testes unitários: `nome_arquivo` (OJ único, misto, fora do padrão), retry do coletor com
  `fetch` falso (429 → backoff → sucesso; falha persistente → "não lidos").
- Os testes antigos copiados (`tests/*.test.mjs`) continuam verdes.
- **Ao vivo (usuário, no PJe logado)**: cronometrar o bookmarklet antigo × o novo na mesma
  caixa; conferir download automático e nome do arquivo no Chrome e no Firefox; abrir/imprimir
  o PDF. (Não testo em Chrome por conta própria.)

## Riscos
- Outro TRT pode ter `script-src` no CSP → o loader mostra a mensagem de erro; plano B futuro:
  bookmarklet autocontido (só se aparecer o caso).
- Concorrência alta pode provocar 429 → mitigado pelo backoff adaptativo; ajustar o número ao vivo.
- Script hospedado é ponto de confiança: só o código vem de fora; os dados nunca saem do navegador.
