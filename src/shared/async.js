// Utilidades de asincronia: pausas cancelables y combinacion de senales de aborto.

const abortReason = (signal) =>
  signal.reason || new DOMException('This operation was aborted', 'AbortError');

// Pausa de "ms" milisegundos. Si "signal" se aborta, rechaza de inmediato.
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortReason(signal));

    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Senal que se aborta cuando cualquiera de las senales recibidas se aborta.
// Equivale a AbortSignal.any (Node 20.3+), pero funciona tambien en Node 18.
function anySignal(signals) {
  const active = signals.filter(Boolean);
  if (active.length <= 1) return active[0];

  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(abortReason(signal));
      break;
    }
    signal.addEventListener('abort', () => controller.abort(abortReason(signal)), { once: true });
  }
  return controller.signal;
}

// Como Promise.all(items.map(fn)), pero con a lo sumo "limit" tareas en curso a la vez (para no
// abrir decenas de conexiones a la misma fuente). Mantiene el orden de "items" en el resultado.
async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

module.exports = { sleep, anySignal, abortReason, mapWithLimit };
