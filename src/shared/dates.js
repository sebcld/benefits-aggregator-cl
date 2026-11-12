// Utilidades puras de fechas. Las fechas de negocio se manejan como texto "YYYY-MM-DD".

const CHILE_TIME_ZONE = 'America/Santiago';

// Fecha (YYYY-MM-DD) de un instante en horario de Chile, sin desfases UTC.
const todayInChile = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: CHILE_TIME_ZONE }).format(now);

// Convierte "dd/mm/yyyy" a "yyyy-mm-dd". Devuelve '' si no es valida.
const parseDmyDate = (value) => {
  const match = (value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

// true si "today" esta dentro de [from, until], ambos inclusive. Sin fechas => false.
const isWithinRange = (today, from, until) => Boolean(from && until && from <= today && today <= until);

module.exports = { CHILE_TIME_ZONE, todayInChile, parseDmyDate, isWithinRange };
