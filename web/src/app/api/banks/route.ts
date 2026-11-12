// BFF: GET /api/banks -> GET /v1/banks (con cache de una hora en el servidor de Next).
import { connection } from 'next/server';
import { getBanks } from '@/lib/server/benefits';
import { errorBody } from '@/lib/server/upstream';

export async function GET() {
  // Se resuelve en cada peticion (no en el build, cuando la API puede no estar disponible).
  await connection();
  try {
    return Response.json({ banks: await getBanks() }, { headers: { 'cache-control': 'public, max-age=300' } });
  } catch {
    return Response.json(errorBody('UPSTREAM_UNAVAILABLE', 'No se pudo obtener la lista de emisores'), { status: 502 });
  }
}
