const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanText, decodeHtml, normalize, toTitleCase } = require('../../../src/shared/text');
const { todayInChile, parseDmyDate, isWithinRange } = require('../../../src/shared/dates');

test('cleanText quita HTML, decodifica entidades y colapsa espacios', () => {
  assert.equal(cleanText('<p>Hola&nbsp;&amp;\n  <b>chao</b></p>'), 'Hola & chao');
  assert.equal(cleanText(null), '');
  assert.equal(cleanText(undefined), '');
});

test('decodeHtml decodifica entidades numericas y hexadecimales', () => {
  assert.equal(decodeHtml('&#8211; &#x41; &quot;x&quot; &#39;y&#39;'), '– A "x" \'y\'');
});

test('normalize deja texto comparable', () => {
  assert.equal(normalize('  El Café ROSA!! '), 'el cafe rosa');
  assert.equal(normalize("Wendy's"), 'wendy s');
});

test('toTitleCase', () => {
  assert.equal(toTitleCase('big5 dto'), 'Big5 Dto');
  assert.equal(toTitleCase(''), '');
});

test('todayInChile usa la zona horaria de Chile', () => {
  // 02:00 UTC del 13 es todavia el 12 en Chile (UTC-3).
  assert.equal(todayInChile(new Date('2026-11-13T02:00:00Z')), '2026-11-12');
  assert.equal(todayInChile(new Date('2026-11-13T04:00:00Z')), '2026-11-13');
});

test('parseDmyDate', () => {
  assert.equal(parseDmyDate('1/2/2026'), '2026-02-01');
  assert.equal(parseDmyDate(' 31/12/2026 '), '2026-12-31');
  assert.equal(parseDmyDate('2026-12-31'), '');
  assert.equal(parseDmyDate(undefined), '');
});

test('isWithinRange es inclusivo y exige ambas fechas', () => {
  assert.equal(isWithinRange('2026-11-30', '2026-11-01', '2026-11-30'), true);
  assert.equal(isWithinRange('2026-12-01', '2026-11-01', '2026-11-30'), false);
  assert.equal(isWithinRange('2026-11-10', '', '2026-11-30'), false);
});
