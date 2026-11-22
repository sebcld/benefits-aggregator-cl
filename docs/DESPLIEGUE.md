# Despliegue

Cómo publicar la web y la API: en una plataforma administrada (Vercel, Render o similares) o en un servidor propio.

## Qué se despliega

Son **dos procesos de Node 26** que se despliegan por separado:

| Proceso | Carpeta | Arranque | Puerto por defecto | Expuesto a internet |
|---|---|---|---|---|
| **API** | raíz del repo | `npm start` (`node src/server.js`) | `PORT` (3000) | No hace falta |
| **Web** (Next.js con BFF) | `web/` | `npm run build` y `npm start` | 3001 | Sí |

El navegador solo habla con la web. La web llama a la API desde su servidor, a través de las rutas `/api/*` (el BFF), así que la URL de la API nunca llega al navegador ([ADR 0022](adr/0022-web-nextjs-con-bff.md)).

## Tres reglas antes de elegir dónde

1. **La API tiene que ser un proceso que siga vivo.** Guarda los catálogos en memoria y los vuelve a descargar una vez al día a la hora `REFRESH_TIME` ([ADR 0024](adr/0024-actualizacion-diaria-programada.md)), con un timer del propio proceso. Una descarga completa tarda unos 10-20 s y decenas de peticiones a las fuentes (más de 100 con Entel, que pide la ficha de cada beneficio). En un entorno serverless, como las funciones de Vercel, cada instancia nueva parte con la caché vacía y vuelve a descargar todo. Por eso la API va en un *web service* (Render, Railway, Fly.io) o en un servidor propio, **no en Vercel**. La web sí funciona bien en Vercel.
2. **Configura siempre la API key** ([ADR 0014](adr/0014-autenticacion-con-api-key.md)). Con `API_KEYS` en la API y la misma llave en `BENEFITS_API_KEY` de la web, la API responde **401** a cualquiera que no sea la web, aunque su URL sea pública. Solo `GET /health` queda abierto, para el health check de la plataforma. Sin `API_KEYS`, la API responde a cualquiera (el log lo avisa al iniciar). Si además puedes dejar la API en una red privada (Render, Docker) o detrás de un firewall, mejor: son dos capas.
3. **Node 26.** El repo lo fija en `.nvmrc` y en `engines`. Confírmalo en cada plataforma (abajo se indica dónde).

## Opciones

| Opción | Web | API | Para qué sirve | Ojo con |
|---|---|---|---|---|
| **A** | Vercel | Render (web service) | Lo más simple con plataformas administradas | La API queda con URL pública: protegida solo por la API key (regla 2) |
| **B** | Render | Render (private service) | Todo en un lugar, con la API sin URL pública | Dos servicios de pago |
| **C** | Servidor propio | Servidor propio | Control total y costo fijo | Mantener tú el sistema operativo, HTTPS y actualizaciones |

**El plan gratis de Render no sirve para la API.** El servicio se apaga tras 15 minutos sin tráfico y tarda alrededor de un minuto en volver. Además, al apagarse se pierde la caché, así que la primera búsqueda después espera ese minuto más los 10-20 s de descarga, y la actualización de las 09:00 no corre si el servicio está dormido. Para probar sirve; para usarlo de verdad, un plan pago.

**Una sola instancia de la API.** Cada instancia tiene su propia caché y su propia actualización diaria: con dos, las fuentes reciben el doble de descargas. Si usas PM2, déjalo en modo `fork` con una instancia (no `-i max` ni modo `cluster`).

## Variables de entorno

### API (raíz del repo)

La lista completa está en [`.env.example`](../.env.example). Para producción:

| Variable | Valor recomendado | Por qué |
|---|---|---|
| `API_KEYS` | `web:<llave>` | **Obligatoria en producción.** Sin llave válida, todo responde 401 salvo `GET /health`. Mínimo 32 caracteres. Es un secreto |
| `BCI_SUBSCRIPTION_KEY` | la llave de BCI | **Obligatoria**; sin ella, BCI sale "no disponible". Es un secreto: va en la configuración de la plataforma, nunca en el repo |
| `REFRESH_TIME` | `09:00` (por defecto) | Hora de Chile a la que se vuelven a descargar todos los catálogos. La caché dura hasta esa hora del día siguiente (más 1 h de margen). `/v1/health` muestra la próxima ejecución y el resultado de la última (`cache.schedule`) |
| `CACHE_WARMUP` | `true` (por defecto) | Descarga los catálogos al iniciar o reiniciar, así la primera búsqueda ya es rápida |
| `CACHE_TTL_SECONDS` | vacía | **Obsoleta.** Si tu `.env` todavía tiene `7200`, bórrala: ya no tiene efecto y el log lo avisa (`config_warning`). Solo `0` hace algo: desactiva la caché |
| `CACHE_REFRESH_MIN_AGE_SECONDS` | `300` (por defecto) | El botón "Actualizar" puede volver a descargar como mucho cada 5 min por emisor |
| `LOG_LEVEL` | `info` (por defecto en el servidor) | Logs JSON en stderr |
| `JINA_API_KEY` | opcional | Sube el límite de uso de `r.jina.ai` (Banco de Chile) |
| `CORS_ORIGINS` | vacío | La web llama desde su servidor, no desde el navegador: no necesita CORS |
| `PORT` | lo define la plataforma | La API lo respeta |

La API lee un archivo `.env` en la raíz del repo, pero las variables del sistema (las que configuras en la plataforma) tienen prioridad.

**Generar la llave** (una vez, en tu equipo):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

La llave va **en dos lugares**: en la API como `API_KEYS=web:<llave>` y en la web como `BENEFITS_API_KEY=<llave>` (la llave sola, sin `web:`).

**Para rotarla sin cortar el servicio:**
1. Agrega la llave nueva en la API: `API_KEYS=web:<vieja>,web2:<nueva>`.
2. Cambia `BENEFITS_API_KEY` en la web por la nueva.
3. Quita la vieja de la API.

### Web (`web/`)

La lista completa está en [`web/.env.example`](../web/.env.example).

| Variable | Valor | Cuándo se lee |
|---|---|---|
| `BENEFITS_API_URL` | URL de la API, sin `/` al final (por ejemplo `https://beneficios-api.onrender.com` o `http://api:3000`) | Al ejecutar (servidor) |
| `BENEFITS_API_TIMEOUT_MS` | `65000` (por defecto) | Al ejecutar. La API corta cada emisor a los 60 s |
| `BENEFITS_API_KEY` | la misma llave de `API_KEYS` (sin el nombre) | Al ejecutar. Va como `Authorization: Bearer` en cada petición a la API. **Nunca con prefijo `NEXT_PUBLIC_`**: el BFF se niega a funcionar si la encuentra así |
| `NEXT_PUBLIC_CONTACT_URL` | enlace "Contacto" del header | **Al compilar**: si la cambias, hay que volver a hacer el build |

---

## Opción A: web en Vercel y API en Render

### 1. API en Render (web service)

1. En Render: **New → Web Service** y conecta el repositorio de GitHub.
2. Configura el servicio:
   - **Root Directory:** vacío (la raíz del repo).
   - **Runtime:** Node.
   - **Build Command:** `npm ci`. La API no tiene dependencias, pero Render pide un comando.
   - **Start Command:** `npm start`.
   - **Health Check Path:** `/health`. Es la única ruta sin llave: `/v1/health` responde 401 sin ella y Render marcaría el servicio como caído.
   - **Instance type:** uno pago (ver la nota sobre el plan gratis).
3. En **Environment**, agrega `NODE_VERSION=26` (así no depende de qué archivo lea Render), `API_KEYS=web:<llave>` y `BCI_SUBSCRIPTION_KEY`. `REFRESH_TIME` (09:00) y `CACHE_WARMUP` (`true`) ya vienen por defecto. `PORT` lo pone Render.
4. Al terminar el deploy, anota la URL (`https://<nombre>.onrender.com`) y prueba:

   ```bash
   curl https://<nombre>.onrender.com/health                     # 200, sin llave
   curl -i "https://<nombre>.onrender.com/v1/search?q=dunkin"     # 401: sin llave no responde
   curl -H "Authorization: Bearer <llave>" "https://<nombre>.onrender.com/v1/search?q=dunkin&pageSize=1"
   ```

### 2. Web en Vercel

1. En Vercel: **Add New → Project** e importa el mismo repositorio.
2. Configura el proyecto:
   - **Root Directory:** `web`. Es importante: la web vive en una subcarpeta.
   - **Framework Preset:** Next.js (lo detecta solo). Build y salida por defecto.
   - **Node.js Version** (Settings → Build and Deployment): `26.x`.
3. En **Environment Variables** (Production), agrega `BENEFITS_API_URL=https://<nombre>.onrender.com` y `BENEFITS_API_KEY=<llave>` (márcala como *Sensitive*), más `NEXT_PUBLIC_CONTACT_URL` si la usas. Si las vistas previas de los PR también deben llamar a la API, agrega `BENEFITS_API_KEY` en *Preview* (idealmente con otra llave de `API_KEYS`, para revocarla por separado).
4. **Deploy.** Cada push a `main` vuelve a desplegar la web, y cada PR genera una vista previa.

Notas:
- **Duración de las funciones:** el BFF espera a la API hasta 65 s, y con Fluid compute (activado por defecto) las funciones de Vercel duran hasta 300 s en todos los planes, así que alcanza. Si en tu proyecto Fluid compute está desactivado, el límite de Hobby es de 60 s: actívalo.
- **Regiones:** elige regiones cercanas entre sí para la función de Vercel y el servicio de Render. Cada búsqueda de la web hace una petición a la API, y la primera, varias más para los conteos de los filtros.

## Opción B: todo en Render

1. **API como Private Service** (New → Private Service), con la misma configuración que en la opción A, incluida `API_KEYS`. No tiene URL pública: solo la alcanzan tus otros servicios de Render en la misma región. La llave suma una segunda capa.
2. **Web como Web Service**, con esta configuración:
   - **Root Directory:** `web`.
   - **Build Command:** `npm ci && npm run build`.
   - **Start Command:** `npx next start -p $PORT`. `npm start` fija el puerto 3001, y Render espera el de `$PORT`.
   - **Health Check Path:** `/`.
   - **Environment:** `NODE_VERSION=26`, `BENEFITS_API_KEY=<llave>` y `BENEFITS_API_URL` = la **Internal URL** que muestra Render en el servicio de la API (sin `/` final).
3. Dominio propio: en el servicio de la web, Settings → Custom Domains. Render emite el certificado HTTPS.

## Opción C: servidor propio

Se necesita un servidor Linux (Ubuntu o Debian en los ejemplos), con un dominio que apunte a su IP y **al menos 1 GB de RAM**. El build de Next puede pedir más; si se queda corto, compila en otro equipo o agrega swap.

En el servidor quedan la API y la web escuchando solo localmente, y un proxy inverso (Caddy o nginx) con HTTPS delante de la web. Next recomienda no exponer su servidor directo a internet.

```
internet ──443──> Caddy ──> web :3001 ──> API :3000
                  (HTTPS)   (Next, BFF)   (no se expone)
```

Hay dos formas de montarlo: **C1** con Node instalado y systemd, o **C2** con Docker Compose.

### C1. Node + systemd + Caddy

**1. Node 26 y el código**

```bash
# Node 26: con NodeSource (https://github.com/nodesource/distributions) o con nvm/fnm.
node --version   # debe decir v26.x
which node       # anota la ruta para los servicios de systemd

sudo useradd --system --create-home --home-dir /opt/beneficios beneficios
sudo -u beneficios git clone https://github.com/<usuario>/benefits-aggregator-cl.git /opt/beneficios/app
cd /opt/beneficios/app
sudo -u beneficios npm ci
cd web && sudo -u beneficios npm ci && sudo -u beneficios npm run build
```

**2. Variables.** Créalas como el usuario `beneficios` y con permisos `600`, porque tienen secretos:
- `/opt/beneficios/app/.env`: `API_KEYS=web:<llave>` y `BCI_SUBSCRIPTION_KEY=...` (`REFRESH_TIME=09:00` y `CACHE_WARMUP=true` vienen por defecto). La API lo lee sola.
- `/opt/beneficios/app/web/.env.production.local`: `BENEFITS_API_URL=http://127.0.0.1:3000` y `BENEFITS_API_KEY=<llave>`. Next lo carga al iniciar. `NEXT_PUBLIC_CONTACT_URL` tiene que estar **antes** del build.

**3. Servicios de systemd**

`/etc/systemd/system/beneficios-api.service`:

```ini
[Unit]
Description=Beneficios CL - API
After=network-online.target
Wants=network-online.target

[Service]
User=beneficios
WorkingDirectory=/opt/beneficios/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/beneficios-web.service`:

```ini
[Unit]
Description=Beneficios CL - Web
After=network-online.target beneficios-api.service
Wants=network-online.target

[Service]
User=beneficios
WorkingDirectory=/opt/beneficios/app/web
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Cambia `/usr/bin/node` y `/usr/bin/npm` por lo que diga `which` si instalaste Node con nvm. Después:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now beneficios-api beneficios-web
journalctl -u beneficios-api -f      # logs (JSON)
```

**4. HTTPS con Caddy.** Caddy obtiene y renueva el certificado solo. Archivo `/etc/caddy/Caddyfile`:

```caddy
beneficios.tudominio.cl {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3001 {
		# La web transmite por partes (streaming); sin esto el proxy podria esperar la respuesta entera.
		flush_interval -1
	}
}
```

```bash
sudo systemctl reload caddy
```

Si prefieres **nginx**, haz `proxy_pass http://127.0.0.1:3001;` con `proxy_buffering off;` (por el streaming), y certbot para HTTPS.

**5. Firewall.** La API escucha en todas las interfaces del puerto 3000. Aunque exige la API key, no hay motivo para exponerla: solo la usa la web, en el mismo equipo. Deja pasar solo SSH, HTTP y HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable        # todo lo demas (3000, 3001) queda cerrado desde afuera
```

**6. Actualizar a una versión nueva**

```bash
cd /opt/beneficios/app
sudo -u beneficios git pull
sudo -u beneficios npm ci
cd web && sudo -u beneficios npm ci && sudo -u beneficios npm run build
sudo systemctl restart beneficios-api beneficios-web
```

Al reiniciar (con systemd, PM2 o Docker), la API pierde la caché y la vuelve a llenar sola en unos 10-20 s (`CACHE_WARMUP=true`, por defecto). La actualización diaria se vuelve a programar al iniciar: el log lo confirma con `scheduled_refresh_planned`, y cada ejecución deja `scheduled_refresh_done` (con `status` y los emisores que fallaron) o `scheduled_refresh_failed`.

### C2. Docker Compose

> Estos archivos **no están en el repo ni se probaron todavía**: cópialos y construye las imágenes una vez para verificarlos. Los tres procesos son los mismos de C1.

**`Dockerfile`** (raíz, API). La API no tiene dependencias: basta con el código y `package.json`.

```dockerfile
FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY src ./src
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
```

**`web/Dockerfile`** (web):

```dockerfile
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_CONTACT_URL=
ENV NEXT_PUBLIC_CONTACT_URL=$NEXT_PUBLIC_CONTACT_URL
RUN npm run build

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3001
USER node
CMD ["npm", "start"]
```

**`.dockerignore`** (uno en la raíz y otro en `web/`). Es importante para que la llave de BCI y las API keys no queden dentro de la imagen:

```
node_modules
.next
.env
.env.*
!.env.example
```

**`compose.yaml`** (raíz):

```yaml
services:
  api:
    build: .
    env_file: .env            # API_KEYS=web:<llave>, BCI_SUBSCRIPTION_KEY (REFRESH_TIME=09:00 por defecto)
    restart: unless-stopped
    # Sin "ports": la API solo es visible para la web, dentro de la red de Compose.
    healthcheck:
      # /health es la unica ruta sin API key.
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3

  web:
    build:
      context: ./web
      args:
        NEXT_PUBLIC_CONTACT_URL: ""
    environment:
      BENEFITS_API_URL: http://api:3000
      # Compose lo toma del .env de la raiz: agrega ahi BENEFITS_API_KEY=<llave> (la misma de API_KEYS).
      BENEFITS_API_KEY: ${BENEFITS_API_KEY:?Falta BENEFITS_API_KEY en .env}
    depends_on:
      - api
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"  # solo local: Caddy (en el host) la publica con HTTPS
```

```bash
docker compose up -d --build
docker compose logs -f api
```

Usa el mismo Caddyfile de C1. Ojo: Docker se salta las reglas de `ufw` en los puertos que publica. Por eso la API no publica ninguno y la web solo publica en `127.0.0.1`.

### Servidor en casa (sin IP pública fija)

Si el servidor está detrás del router de tu casa, puedes evitar abrir puertos con un túnel, como [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (`cloudflared`): apúntalo a `http://localhost:3001` y no necesitas Caddy ni redirigir puertos. La API sigue cerrada, como en C1.

---

## Verificar el despliegue

1. **API:**
   - `GET /health` (sin llave) debe responder `{"status":"ok"}`.
   - `GET /v1/search?q=x` **sin** llave debe responder **401**. Si responde 200, `API_KEYS` no está configurada.
   - `curl -H "Authorization: Bearer <llave>" "<api>/v1/health?probe=true"` descarga los catálogos y muestra el estado de cada emisor. Si sale `degraded`, revisa el `error` del emisor que falla.
2. **Web:** abre la página de inicio. Deben verse "Destacados de hoy" y el buscador.
3. **Búsqueda completa:** busca `dunkin`. Tiene que haber resultados de varios emisores y la línea "Datos actualizados hace…".
4. **En vivo desde tu equipo:** `npm run smoke` corre los casos de aceptación contra las fuentes reales (usa tu `.env`).

## Problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| La web muestra "El servicio de beneficios no está disponible" | `BENEFITS_API_URL` mal escrita o la API caída (el BFF responde `UPSTREAM_UNAVAILABLE`) | Prueba la URL con `curl <url>/health` desde donde corre la web |
| Lo mismo, y el log de la web dice `[bff] La API respondio 401` | `BENEFITS_API_KEY` vacía o distinta de la llave de `API_KEYS` (el BFF responde `UPSTREAM_UNAUTHORIZED`) | Copia la misma llave en las dos variables (en `API_KEYS`, después del `web:`) |
| Las búsquedas fallan (las rutas `/api/*` responden 500) y el log nombra `NEXT_PUBLIC_...` | La llave quedó con prefijo `NEXT_PUBLIC_` | Renómbrala a `BENEFITS_API_KEY` y vuelve a hacer el deploy |
| La API no arranca: `API_KEYS: la llave de "web" debe tener al menos 32 caracteres` | Llave demasiado corta | Genera una con el comando de [Variables de entorno](#api-raíz-del-repo) |
| La plataforma marca la API como caída | El health check apunta a una ruta con llave (`/v1/health`) | Usa `/health` |
| "BCI no disponible" | Falta `BCI_SUBSCRIPTION_KEY` o la llave cambió ([riesgo #6](RIESGOS.md)) | Revisa la variable; si responde 401 o 403, consigue la llave nueva |
| La primera búsqueda tarda 10-20 s o más | Caché vacía: recién iniciada, o un emisor falló en la actualización diaria y su catálogo venció | `CACHE_WARMUP=true` (por defecto). Revisa `cache.schedule.lastRun` en `/v1/health`. En Render gratis, además, el servicio se durmió |
| Los datos no cambian desde ayer | La actualización diaria es a las `REFRESH_TIME` (09:00) | Botón "Actualizar" de la web, o revisa `cache.schedule.nextRunAt` en `/v1/health` |
| Render no marca la web como lista | La web escucha en 3001 y Render espera `$PORT` | Start Command `npx next start -p $PORT` |
| El build en Vercel no encuentra `package.json` | Root Directory sin configurar | Root Directory = `web` |
| Las páginas cargan de golpe al final, en vez de por partes | El proxy está acumulando la respuesta (buffering) | Caddy: `flush_interval -1`; nginx: `proxy_buffering off;` |
| Cambié `NEXT_PUBLIC_CONTACT_URL` y no cambia | Esa variable se fija al compilar | Vuelve a hacer el build (o el deploy) |
