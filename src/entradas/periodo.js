/*
 * Período das "entradas do dia anterior" na caixa.
 * Padrão: do último dia útil (seg–sex) às 00:00 até hoje às 00:00. Na segunda-feira, isso
 * cobre sexta, sábado e domingo. Feriados não são conhecidos aqui: o usuário pode digitar
 * outra data de início (ex.: depois de um feriado, ou se esqueceu de rodar um dia).
 */

const dois = n => String(n).padStart(2, '0');

export function inicioDoDia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Último dia útil antes de `agora` (sábado e domingo pulados), às 00:00. */
export function ultimoDiaUtil(agora = new Date()) {
  const d = inicioDoDia(agora);
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

export function dataBR(d) {
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "06/11/2026" ou "6/11/26" → Date às 00:00 (hora local); inválida → null. */
export function lerDataBR(texto) {
  const m = String(texto || '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(ano, Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
  return d;
}

/**
 * Janela [inicio, fim): fim = hoje às 00:00 (as entradas de hoje ficam para amanhã).
 * Se a data escolhida for hoje ou futura, a janela vai até agora.
 */
export function janelaDesde(inicio, agora = new Date()) {
  const hoje = inicioDoDia(agora);
  const fim = inicio.getTime() >= hoje.getTime() ? new Date(agora.getTime() + 1) : hoje;
  return { inicio, fim };
}

/** Item da listagem do PJe → entrou na tarefa dentro da janela? */
export function entrouNaJanela(item, { inicio, fim }) {
  const bruto = item && item.dataEntradaTarefa;
  if (!bruto) return false;
  const t = new Date(bruto).getTime();
  return !isNaN(t) && t >= inicio.getTime() && t < fim.getTime();
}

/** Texto do período para a capa e para o nome do arquivo. */
export function descreverJanela({ inicio, fim }) {
  const ultimoDia = new Date(fim.getTime() - 1);
  const mesmoDia = inicioDoDia(ultimoDia).getTime() === inicio.getTime();
  return {
    legivel: mesmoDia ? `em ${dataBR(inicio)}` : `de ${dataBR(inicio)} a ${dataBR(ultimoDia)}`,
    arquivo: mesmoDia ? dataBR(inicio).replace(/\//g, '-')
      : `${dataBR(inicio).replace(/\//g, '-')} a ${dataBR(ultimoDia).replace(/\//g, '-')}`
  };
}
