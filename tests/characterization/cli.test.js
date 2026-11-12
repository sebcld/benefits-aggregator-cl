// Caracterizacion del CLI: stdout, stderr y codigo de salida identicos al original.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const golden = require('../fixtures/golden/cli.json');
const { runCli } = require('../helpers/processes');

for (const [name, expected] of Object.entries(golden)) {
  test(`CLI: ${name}`, async () => {
    const args = name === '(sin argumentos)' ? [] : [name];
    const actual = await runCli(args);
    assert.equal(actual.stdout, expected.stdout);
    assert.equal(actual.stderr, expected.stderr);
    assert.equal(actual.code, expected.code);
  });
}
