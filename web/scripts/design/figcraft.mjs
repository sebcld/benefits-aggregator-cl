// Lector del archivo de diseno FigCraft (design/beneficios_CL.figcraft).
// Un .figcraft es un zip con document.json (+ thumbnail.png). Se lee con zlib nativo,
// sin dependencias, recorriendo el directorio central del zip.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DESIGN_FILE = path.resolve(HERE, '../../../design/beneficios_CL.figcraft');

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

function readZipEntries(buffer) {
  // El "end of central directory" esta en los ultimos 22 bytes (+ comentario opcional).
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('El archivo de diseno no es un zip valido');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new Error('Directorio central del zip corrupto');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);
    entries.set(name, () => (method === 0 ? raw : inflateRawSync(raw)));

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Devuelve el document.json del archivo de diseno ya parseado. */
export function readDesign(file = DESIGN_FILE) {
  const entries = readZipEntries(readFileSync(file));
  const doc = entries.get('document.json');
  if (!doc) throw new Error('El archivo de diseno no contiene document.json');
  const json = JSON.parse(doc().toString('utf8'));
  if (json.format !== 'figcraft') throw new Error(`Formato inesperado: ${json.format}`);
  return json;
}

/** Color de FigCraft ({r,g,b,a} en 0..1) a CSS. Opaco => #rrggbb; con alfa => rgb(r g b / a). */
export function toCssColor({ r, g, b, a = 1 }, opacity = 1) {
  const to255 = (v) => Math.round(v * 255);
  const alpha = Math.round(a * opacity * 1000) / 1000;
  if (alpha >= 1) {
    return `#${[r, g, b].map((v) => to255(v).toString(16).padStart(2, '0')).join('')}`;
  }
  return `rgb(${to255(r)} ${to255(g)} ${to255(b)} / ${alpha})`;
}
