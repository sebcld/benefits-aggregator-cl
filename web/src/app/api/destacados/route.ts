// BFF: GET /api/destacados -> beneficios para "Destacados de hoy" (inicio movil), cache de 2 horas.
import { connection } from 'next/server';
import { getFeatured } from '@/lib/server/benefits';
import { errorBody } from '@/lib/server/upstream';

export async function GET() {
  await connection();
  try {
    return Response.json({ results: await getFeatured() }, { headers: { 'cache-control': 'public, max-age=300' } });
  } catch {
    return Response.json(errorBody('UPSTREAM_UNAVAILABLE', 'No se pudieron obtener los destacados'), { status: 502 });
  }
}
