// Se ejecuta una vez al iniciar el servidor de Next, antes de atender peticiones.
// Si una llave quedo con prefijo NEXT_PUBLIC_ (Next la incrustaria en el JavaScript del navegador
// si el codigo la usara), el error queda en el log al iniciar. Next no detiene el proceso por un
// error aqui, pero el BFF tampoco funciona: upstreamConfig() vuelve a comprobarlo y cada /api/*
// responde 500 hasta que se corrija la variable.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertNoPublicSecrets } = await import('./lib/server/upstream');
  assertNoPublicSecrets();
}
