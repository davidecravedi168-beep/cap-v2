import test from 'node:test';
import assert from 'node:assert/strict';
import gateway, { MODEL_BOARD_VERSION, ROLE_MODEL_BOARD, routeForAgent } from '../server/office-multifree.mjs';

test('real Model Board routes each core role to an explicit zero-cost preference', () => {
  for (const agent of ['Direttore','Lumen','Coda','Mosaic','Sage','Aegis','Verity','Ledger','Archivist','Qualita']) {
    const row = routeForAgent(agent);
    assert.ok(row);
    assert.ok(Array.isArray(row.route) && row.route.length >= 2);
    assert.ok(row.route[0].provider);
    assert.ok(row.route[0].model);
  }
  assert.equal(routeForAgent('Coda').route[0].model, 'cohere/north-mini-code');
  assert.equal(routeForAgent('Verity').route[0].provider, 'Vireonix');
  assert.equal(routeForAgent('unknown'), ROLE_MODEL_BOARD.Direttore);
});

test('health exposes the real model board and zero-cost role routing', async () => {
  const response = await gateway.fetch(new Request('https://office.invalid/health'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.zeroCost, true);
  assert.equal(body.roleRouting, true);
  assert.equal(body.modelBoardVersion, MODEL_BOARD_VERSION);
  assert.equal(body.modelBoard.Coda.preferred.model, 'cohere/north-mini-code');
  assert.equal(body.modelBoard.Verity.preferred.provider, 'Vireonix');
});
