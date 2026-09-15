import test from 'node:test';
import assert from 'node:assert/strict';
import gateway, { MODEL_BOARD_VERSION, ROLE_MODEL_BOARD, routeForAgent } from '../server/office-multifree.mjs';

test('real Model Board routes each core role only through an actually zero-cost provider', () => {
  for (const agent of ['Direttore','Lumen','Coda','Mosaic','Sage','Aegis','Verity','Ledger','Archivist','Qualita']) {
    const row = routeForAgent(agent);
    assert.ok(row);
    assert.ok(Array.isArray(row.route) && row.route.length >= 1);
    assert.equal(row.route[0].provider, 'Vireonix');
    assert.equal(row.route[0].model, 'auto');
    assert.equal(row.route.some(r => r.provider === 'BlockRun'), false);
  }
  assert.equal(routeForAgent('unknown'), ROLE_MODEL_BOARD.Direttore);
});

test('health exposes only the real active zero-cost provider and explains disabled providers', async () => {
  const response = await gateway.fetch(new Request('https://office.invalid/health'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.zeroCost, true);
  assert.equal(body.roleRouting, true);
  assert.equal(body.modelBoardVersion, MODEL_BOARD_VERSION);
  assert.deepEqual(body.providers, ['Vireonix']);
  assert.equal(body.modelBoard.Coda.preferred.model, 'auto');
  assert.equal(body.modelBoard.Verity.preferred.provider, 'Vireonix');
  assert.ok(body.disabledProviders.some(x => /BlockRun.*x402/i.test(x)));
});
