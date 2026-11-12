// Utilidades puras de texto: limpieza de HTML, normalizacion para busqueda y formato.

const decodeHtml = (text) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

// Quita etiquetas HTML, decodifica entidades y colapsa espacios. Acepta null/undefined.
const cleanText = (text) =>
  decodeHtml((text || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Texto comparable: minusculas, sin tildes ni puntuacion, espacios colapsados.
const normalize = (text) =>
  cleanText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, ' ') // elimina puntuacion como apostrofes/guiones
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (text, limit = 180) =>
  text.length > limit ? `${text.slice(0, limit - 3).trimEnd()}...` : text;

const toTitleCase = (text) =>
  (text || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

module.exports = { decodeHtml, cleanText, escapeRegex, normalize, truncate, toTitleCase };
