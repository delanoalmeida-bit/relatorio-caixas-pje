/**
 * Utilitários de normalização de texto e caracteres para classificadores.
 */

export function normaliza(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function normalizaRegexPattern(p) {
  return (p || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\\b/g, '___BACKSLASH_B___').replace(/\\B/g, '___BACKSLASH_UB___')
    .replace(/\\d/g, '___BACKSLASH_D___').replace(/\\s/g, '___BACKSLASH_S___').replace(/\\w/g, '___BACKSLASH_W___')
    .toUpperCase()
    .replace(/___BACKSLASH_B___/g, '\\b').replace(/___BACKSLASH_UB___/g, '\\B')
    .replace(/___BACKSLASH_D___/g, '\\d').replace(/___BACKSLASH_S___/g, '\\s').replace(/___BACKSLASH_W___/g, '\\w');
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

