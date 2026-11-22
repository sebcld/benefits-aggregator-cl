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

// "HH:MM" de 00:00 a 23:59. Devuelve { hour, minute } o null si no es valido.
const parseClockTime = (value) => {
  const match = String(value || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
};

// Fecha y hora "de pared" de un instante en una zona horaria (h23: 00-23, nunca "24").
function wallClock(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

// Desfase de la zona en ese instante (ms): Chile es -3 h en verano y -4 h en invierno.
function zoneOffsetMs(ms, timeZone) {
  const w = wallClock(ms, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - (ms - (ms % 1000));
}

// Instante (ms UTC) de una fecha y hora de pared en la zona. Se ajusta dos veces por si el
// desfase cambia entre la estimacion y el resultado (dia del cambio de horario).
function zonedTimeToUtc({ year, month, day, hour, minute }, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wall;
  for (let i = 0; i < 2; i += 1) utc = wall - zoneOffsetMs(utc, timeZone);
  return utc;
}

/**
 * Proximo instante (ms UTC) estrictamente posterior a "nowMs" en que el reloj de la zona marca
 * "HH:MM". Por ejemplo, la proxima actualizacion diaria de las 09:00 en Chile. El cambio de horario
 * de Chile ocurre a las 00:00, asi que una hora como 09:00 nunca cae en una hora saltada o repetida.
 */
function nextDailyAt(nowMs, time, timeZone = CHILE_TIME_ZONE) {
  const clock = typeof time === 'string' ? parseClockTime(time) : time;
  if (!clock) throw new TypeError(`Hora invalida: "${time}" (formato HH:MM)`);
  const today = wallClock(nowMs, timeZone);
  const at = zonedTimeToUtc({ ...today, ...clock }, timeZone);
  if (at > nowMs) return at;
  // Manana en el calendario de la zona (Date.UTC normaliza el dia 32 al mes siguiente, etc.).
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  return zonedTimeToUtc(
    { year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate(), ...clock },
    timeZone,
  );
}

module.exports = { CHILE_TIME_ZONE, todayInChile, parseDmyDate, isWithinRange, parseClockTime, nextDailyAt };
