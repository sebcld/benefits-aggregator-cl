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

module.exports = { sleep, anySignal, abortReason };
