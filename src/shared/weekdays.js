// Dias de la semana en que aplica un beneficio, como texto para mostrar.
// Acepta los formatos de las fuentes: "LUNES", "MIERCOLES" (BCI) o "miercoles", "sábado".

const WEEK = [
  ['lunes', 'lunes', 'lunes'],
  ['martes', 'martes', 'martes'],
  ['miercoles', 'miércoles', 'miércoles'],
  ['jueves', 'jueves', 'jueves'],
  ['viernes', 'viernes', 'viernes'],
  ['sabado', 'sábado', 'sábados'],
  ['domingo', 'domingo', 'domingos'],
]; // [clave sin tildes, singular, plural]

const keyOf = (day) =>
  String(day || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * ["LUNES"] -> "Todos los lunes"; ["MARTES","MIERCOLES","JUEVES"] -> "Martes, miércoles y jueves";
 * los 7 dias -> "Todos los días". Ordena de lunes a domingo, ignora repetidos y valores que no son
 * dias. Devuelve '' si no queda ningun dia.
 * @param {string[]} days
 */
function formatWeekdays(days) {
  const wanted = new Set((days || []).map(keyOf));
  const found = WEEK.filter(([key]) => wanted.has(key));
  if (found.length === 0) return '';
  if (found.length === WEEK.length) return 'Todos los días';
  if (found.length === 1) return `Todos los ${found[0][2]}`;
  const names = found.map(([, singular]) => singular);
  return capitalize(`${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`);
}

module.exports = { formatWeekdays };
