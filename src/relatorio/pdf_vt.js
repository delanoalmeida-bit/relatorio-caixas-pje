import {
  Escritor, alturaLinha, A4, MARGEM_X, TOPO, BASE, LARGURA_UTIL, COR_SUAVE, COR_LINHA, COR_TITULO
} from './pdf.js';

/*
 * PDF do 1º grau (estrutura de dados_relatorio_vt.js). Mesma base do projeto original:
 * texto selecionável "Rótulo: valor", sumário clicável, marcadores e links para as fichas.
 */

export function gerarPdfVT(rel, JsPDF) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  const c = rel.capa;
  const titulo = `Relatório da caixa ${c.caixa} - ${c.orgao} (${c.tribunal})`;
  doc.setProperties({
    title: titulo,
    subject: `Caixa ${c.caixa}, gerado em ${c.geradoEm}`,
    creator: `relatoriodetriagem-vt ${c.versao}`.trim(),
    keywords: 'PJe, 1º grau, Vara do Trabalho, triagem'
  });
  if (doc.setLanguage) doc.setLanguage('pt-BR');

  const e = new Escritor(doc);
  const secoes = [];
  const paginaFicha = new Map();
  const linksParaFicha = [];

  const abrirSecao = t => { e.novaPagina(); secoes.push({ titulo: t, pagina: e.pagina }); e.tituloSecao(t); };
  const nota = t => { e.texto(t, { tam: 9, cor: COR_SUAVE }); e.espaco(2); };
  const vazio = t => e.texto(t, { tam: 9, cor: COR_SUAVE });
  const subtitulo = t => { e.garantir(alturaLinha(10) * 3); e.texto(t, { tam: 10, estilo: 'bold', cor: COR_TITULO }); };

  const linhaProcesso = (lp, extras = [], { semFase = false, semResp = false } = {}) => {
    const partes = [`CNJ: ${lp.cnj}`, `Classe: ${lp.classe}`];
    if (!semFase) partes.push(`Fase: ${lp.fase}`);
    partes.push(`Na caixa desde: ${lp.entrada}`);
    if (!semResp) partes.push(`Responsável: ${lp.responsavel}`);
    for (const [r, v] of extras) partes.push(`${r}: ${v}`);
    const pos = e.texto(partes.join(' | '), { tam: 8.5 });
    if (pos) linksParaFicha.push({ pagina: pos.pagina, y: pos.y, h: pos.altura, ordem: lp.ordem });
    e.espaco(0.8);
  };

  /** Tabela simples de duas a quatro colunas, em texto. */
  const tabela = (cabecalho, linhas, larguras) => {
    const lh = alturaLinha(9) + 0.6;
    const xs = [];
    let x = MARGEM_X;
    for (const w of larguras) { xs.push(x); x += w; }
    const desenhar = (cols, estilo) => {
      e.garantir(lh);
      e.fonte(9, estilo);
      cols.forEach((v, i) => {
        const alinhaDireita = i > 0;
        const txt = doc.splitTextToSize(String(v), larguras[i] - 2)[0];
        if (alinhaDireita) doc.text(txt, xs[i] + larguras[i] - 1, e.y + lh * 0.72, { align: 'right' });
        else doc.text(txt, xs[i], e.y + lh * 0.72);
      });
      e.y += lh;
    };
    desenhar(cabecalho, 'bold');
    doc.setDrawColor(...COR_LINHA); doc.setLineWidth(0.2);
    doc.line(MARGEM_X, e.y, MARGEM_X + larguras.reduce((a, b) => a + b, 0), e.y);
    e.espaco(0.6);
    for (const l of linhas) desenhar(l, 'normal');
    e.espaco(4);
  };

  // 1. Capa
  e.y = 40;
  e.texto('RELATÓRIO DA CAIXA', { tam: 22, estilo: 'bold', cor: COR_TITULO });
  e.texto(c.caixa.toUpperCase(), { tam: 22, estilo: 'bold', cor: COR_TITULO });
  e.texto('PJe 1º grau - Painel Global', { tam: 13, cor: COR_SUAVE });
  e.espaco(8); e.linhaHorizontal(); e.espaco(6);
  e.campo('Tribunal', c.tribunal, { tam: 11 });
  e.campo('Vara', c.orgao, { tam: 11 });
  e.campo('Gerado em', c.geradoEm, { tam: 11 });
  e.campo('Critério', c.criterio, { tam: 11 });
  e.campo('Processos na caixa', String(c.totalNaCaixa), { tam: 11 });
  e.campo('Processos neste relatório', String(c.noRelatorio), { tam: 11 });
  e.campo('Processos não lidos', String(c.naoLidos), { tam: 11 });
  e.campo('Há mais tempo na caixa', c.maisAntigo, { tam: 11 });
  e.espaco(10);
  e.texto('Como usar este PDF', { tam: 11, estilo: 'bold' });
  e.espaco(1);
  [
    'O Panorama mostra o tamanho do gargalo por fase, por tempo parado e por responsável.',
    'O sumário (página 2) e os marcadores na barra lateral do leitor levam a cada seção. Nas listagens, clique na linha do processo para abrir a ficha. Para achar um CNJ, use Ctrl+F.',
    'Um mesmo processo aparece em todas as seções a que pertence. O PDF pode ser enviado a uma IA para outras análises.',
    'Dados pessoais (CPF, e-mail, telefone, endereço) foram descartados. Em segredo de justiça, as partes aparecem como "SEGREDO DE JUSTIÇA".',
    '"Na caixa desde" é a data de entrada na tarefa atual, não a idade do processo.'
  ].forEach(t => e.texto('- ' + t, { tam: 9.5, recuo: 2 }));

  // 2. Sumário (preenchido no fim)
  e.novaPagina();
  const paginaSumario = e.pagina;

  // 3. Panorama
  const pn = rel.panorama;
  abrirSecao('Panorama da caixa');
  subtitulo('Por fase');
  tabela(['Fase', 'Processos', 'Mais antigo na caixa'], pn.porFase.map(r => [r.rotulo, r.qtd, r.maisAntigo]), [90, 35, 55]);
  subtitulo('Por tempo na caixa');
  tabela(['Tempo desde a entrada na tarefa', 'Processos'], pn.porTempo.map(r => [r.rotulo, r.qtd]), [90, 35]);
  subtitulo('Por responsável');
  tabela(['Responsável', 'Processos', 'Mais antigo na caixa'], pn.porResponsavel.map(r => [r.rotulo, r.qtd, r.maisAntigo]), [90, 35, 55]);
  if (pn.porTarefa.length > 1) {
    subtitulo('Por tarefa');
    tabela(['Tarefa', 'Processos', 'Mais antigo na caixa'], pn.porTarefa.map(r => [r.rotulo, r.qtd, r.maisAntigo]), [90, 35, 55]);
  }
  subtitulo('Por classe');
  tabela(['Classe', 'Processos'], pn.porClasse.map(r => [r.rotulo, r.qtd]), [145, 35]);
  subtitulo('Indicadores');
  tabela(['Situação', 'Processos'], pn.indicadores, [145, 35]);

  // 4. Prioridades
  abrirSecao(`Prioridade legal (${rel.prioridades.length})`);
  nota('Processos com prioridade de tramitação cadastrada no PJe (ex.: idoso, doença grave), do que está há mais tempo na caixa para o mais recente.');
  if (!rel.prioridades.length) vazio('Nenhum processo com prioridade.');
  for (const lp of rel.prioridades) linhaProcesso(lp, [lp.extra]);

  // 5. Prazo expirado
  abrirSecao(`Prazo expirado no PJe (${rel.prazoExpirado.length})`);
  nota('Processos que o PJe marca com prazo expirado na tarefa.');
  if (!rel.prazoExpirado.length) vazio('Nenhum processo com prazo expirado.');
  for (const lp of rel.prazoExpirado) linhaProcesso(lp);

  // 6. Por responsável
  abrirSecao(`Por responsável (${rel.porResponsavel.length})`);
  nota('Todos os processos de cada responsável, do que está há mais tempo na caixa para o mais recente.');
  for (const r of rel.porResponsavel) {
    subtitulo(`${r.nome.toUpperCase()} (${r.processos.length})`);
    e.espaco(0.5);
    for (const lp of r.processos) linhaProcesso(lp, [], { semResp: true });
    e.espaco(2);
  }

  // 7. Ente público
  abrirSecao(`Ente público no processo (${rel.entesPublicos.length})`);
  nota('União, Estado, Município, autarquia ou fundação em algum polo (pelo cadastro do PJe ou pelo nome da parte).');
  if (!rel.entesPublicos.length) vazio('Nenhum processo com ente público.');
  for (const lp of rel.entesPublicos) linhaProcesso(lp, [lp.extra]);

  // 8. Recuperação judicial / massa falida
  abrirSecao(`Recuperação judicial ou massa falida (${rel.recuperacaoFalencia.length})`);
  nota('Identificado pelo nome da parte ("em recuperação judicial", "massa falida"). Conferir nos autos.');
  if (!rel.recuperacaoFalencia.length) vazio('Nenhum processo identificado.');
  for (const lp of rel.recuperacaoFalencia) linhaProcesso(lp, [lp.extra]);

  // 9. Sindicato
  abrirSecao(`Processos com sindicato (${rel.sindicatos.length})`);
  if (!rel.sindicatos.length) vazio('Nenhum processo com sindicato, federação ou confederação.');
  for (const lp of rel.sindicatos) linhaProcesso(lp, [lp.extra]);

  // 10. Por reclamada
  abrirSecao(`Listagem por reclamada (${rel.reclamadas.length})`);
  nota('Empresas e entes com 2 ou mais processos na caixa; quem tem mais vem primeiro. Processos em segredo de justiça não entram nesta seção.');
  if (!rel.reclamadas.length) vazio('Nenhuma reclamada com mais de um processo.');
  for (const r of rel.reclamadas) {
    subtitulo(`RECLAMADA: ${r.nome}`);
    e.texto(`Processos: ${r.processos.length} | CNPJ: ${r.cnpjs.length ? r.cnpjs.join(', ') : 'não informado'}`, { tam: 8.5, cor: COR_SUAVE });
    e.espaco(1);
    for (const lp of r.processos) linhaProcesso(lp, [['Reclamante', lp.reclamante]]);
    e.espaco(2);
  }

  // 11. Lotes
  abrirSecao(`Lotes para despacho em bloco (${rel.lotes.length})`);
  nota('Dois ou mais processos com a mesma reclamada, o mesmo cadastro de OAB do lado do trabalhador e a mesma fase. O nome do advogado não é exibido.');
  if (!rel.lotes.length) vazio('Nenhum lote identificado.');
  for (const l of rel.lotes) {
    subtitulo(`LOTE Nº ${l.numero} (${l.fase}): ${l.reclamadas.join('; ')}`);
    e.texto(`Processos: ${l.processos.length} | Fase: ${l.fase} | Assuntos em comum: ${l.assuntosComuns.length ? l.assuntosComuns.join('; ') : 'nenhum'}`, { tam: 8.5, cor: COR_SUAVE });
    e.espaco(1);
    for (const lp of l.processos) linhaProcesso(lp, [['Reclamante', lp.reclamante]], { semFase: true });
    e.espaco(2);
  }

  // 12. Fichas
  abrirSecao(`Ficha de cada processo (${rel.fichas.length})`);
  nota('Em ordem de entrada na caixa: do que espera há mais tempo para o mais recente.');
  const lhTitulo = alturaLinha(10.5);
  for (const f of rel.fichas) {
    const altura = lhTitulo + 2 + f.linhas.reduce((s, l) => s + e.medirPares(l), 0) + 4;
    if (altura <= BASE - TOPO) e.garantir(altura); else e.garantir(lhTitulo * 4);
    paginaFicha.set(f.ordem, e.pagina);
    e.texto(`PROCESSO ${f.cnj}`, { tam: 10.5, estilo: 'bold', cor: COR_TITULO });
    e.espaco(1);
    for (const l of f.linhas) e.pares(l);
    e.espaco(2); e.linhaHorizontal(); e.espaco(3);
  }

  // 13. Não lidos
  if (rel.naoLidos.length) {
    abrirSecao(`Processos não lidos (${rel.naoLidos.length})`);
    nota('O PJe falhou nestes processos mesmo após novas tentativas. Gere o relatório de novo mais tarde.');
    for (const n of rel.naoLidos) e.campo(n.cnj, n.motivo);
  }

  for (const l of linksParaFicha) {
    const destino = paginaFicha.get(l.ordem);
    if (!destino) continue;
    doc.setPage(l.pagina);
    doc.link(MARGEM_X, l.y, LARGURA_UTIL, l.h, { pageNumber: destino });
  }

  doc.setPage(paginaSumario);
  e.y = TOPO;
  e.tituloSecao('Sumário');
  const lhSum = alturaLinha(11) + 2;
  for (const s of secoes) {
    e.fonte(11);
    doc.text(s.titulo, MARGEM_X, e.y + lhSum * 0.7);
    doc.text(`pág. ${s.pagina}`, A4.largura - MARGEM_X, e.y + lhSum * 0.7, { align: 'right' });
    doc.link(MARGEM_X, e.y, LARGURA_UTIL, lhSum, { pageNumber: s.pagina });
    e.y += lhSum;
  }
  if (doc.outline && doc.outline.add) {
    doc.outline.add(null, 'Capa', { pageNumber: 1 });
    doc.outline.add(null, 'Sumário', { pageNumber: paginaSumario });
    for (const s of secoes) doc.outline.add(null, s.titulo, { pageNumber: s.pagina });
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COR_SUAVE);
    if (i > 1) {
      doc.text(titulo, MARGEM_X, 10, { maxWidth: LARGURA_UTIL - 45 });
      doc.text(`Gerado em ${c.geradoEm}`, A4.largura - MARGEM_X, 10, { align: 'right' });
      doc.setDrawColor(...COR_LINHA); doc.setLineWidth(0.2);
      doc.line(MARGEM_X, 12.5, A4.largura - MARGEM_X, 12.5);
    }
    doc.text(`pág. ${i} de ${total}`, A4.largura / 2, A4.altura - 8, { align: 'center' });
  }
  doc.setPage(total);
  return doc;
}
