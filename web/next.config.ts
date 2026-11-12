import os from 'node:os';
import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Origenes permitidos para los recursos de desarrollo (HMR) de `next dev`.
 * Next solo acepta localhost; para abrir la web desde el telefono en la red local
 * (http://<IP-de-este-equipo>:3001) se agregan las IPv4 de red de este equipo, que cambian
 * segun la red, asi que no se escriben a mano. DEV_ALLOWED_ORIGINS agrega otros hosts
 * separados por coma (por ejemplo, un tunel: "*.tunnel.example.com"). No afecta a produccion.
 */
function devOrigins(): string[] {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
  const extra = (process.env.DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  return [...new Set([...lan, ...extra])];
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  allowedDevOrigins: devOrigins(),
  turbopack: {
    // La web vive en web/ dentro del repo de la API: se fija la raiz para no tomar otros lockfiles.
    root: path.resolve(__dirname),
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
