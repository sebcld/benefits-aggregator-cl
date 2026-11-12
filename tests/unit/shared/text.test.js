// cleanText: quita bloques que no son texto visible (CSS, JS, comentarios), no solo sus etiquetas.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanText } = require('../../../src/shared/text');

test('quita un bloque <style> completo, con su CSS', () => {
  assert.equal(cleanText('Texto visible\n<style>\n.fake-link { color: #1f1f22; }\n</style>'), 'Texto visible');
});

test('quita <script>, <noscript> y <template> completos', () => {
  assert.equal(cleanText('a <script type="text/javascript">alert(1)</script> b'), 'a b');
  assert.equal(cleanText('a <noscript>activa JS</noscript> b'), 'a b');
  assert.equal(cleanText('a <template><p>oculto</p></template> b'), 'a b');
});

test('quita comentarios HTML: lo comentado no se ve en el sitio de origen', () => {
  // Banco de Chile deja descripciones viejas comentadas (por ejemplo, "vigencia al 31/12/2025").
  assert.equal(cleanText('<!--<p>Texto viejo</p>-->'), '');
  assert.equal(cleanText('Antes <!-- nota interna --> despues'), 'Antes despues');
});

test('mantiene el texto de las etiquetas normales, incluidas las que tienen atributos con JS', () => {
  const html = 'Ingresa al link <span class="fake-link" onclick="window.open(\'x\')">tinyurl.com/tapp </span> y listo';
  assert.equal(cleanText(html), 'Ingresa al link tinyurl.com/tapp y listo');
  assert.equal(cleanText('<p>Hola <strong>mundo</strong></p>'), 'Hola mundo');
});

test('no confunde etiquetas parecidas (<styled>, <scripts>)', () => {
  assert.equal(cleanText('<styled>uno</styled> <scripts>dos</scripts>'), 'uno dos');
});
