import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge = fs.readFileSync(new URL('../src/objective-bridge.mjs', import.meta.url), 'utf8');

test('V10.0.1 Objective bridge never creates a second Runtime', () => {
  assert.doesNotMatch(bridge, /from ['"]\.\/runtime\.mjs['"]/);
  assert.doesNotMatch(bridge, /new Runtime\s*\(/);
});

test('V10.0.1 mission wakes the main app executor immediately', () => {
  assert.match(bridge, /startMission\(e\.detail\?\.id\)/);
  assert.match(bridge, /dispatchEvent\(new Event\(['"]visibilitychange['"]\)\)/);
  assert.match(bridge, /data-job=/);
});
