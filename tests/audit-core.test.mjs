// Runs with Bun or Node 24 alone, even when dependency installation is unavailable.
import { test } from 'node:test';
import assert from 'node:assert/strict';

async function source(name) {
  if (process.versions.bun) {
    return import(`../src/lib/engineering/${name}.ts`);
  }
  const { readFile } = await import('node:fs/promises');
  const { stripTypeScriptTypes } = await import('node:module');
  const text = await readFile(new URL(`../src/lib/engineering/${name}.ts`, import.meta.url), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(text)).toString('base64')}`);
}
const { compileExpression, linspace, sweepFunction } = await source('evaluator');
const store = await source('scopedState');
const { axisExtent, panRange, zoomRange } = await source('plotScales');
test('mathematical precedence, negative powers and right associativity', () => {
  for (const [expression, expected] of [['-x^2', -4], ['(-x)^2', 4], ['2^-2', .25], ['2^3^2', 512], ['-2**2', -4], ['Math.sin(pi/2)', 1]]) {
    assert.equal(compileExpression(expression)(2), expected, expression);
  }
});
test('parameters, constants and nonfinite results', () => {
  assert.equal(compileExpression('gain*x')(3, {gain: 4}), 12);
  assert.equal(compileExpression('e')(0), Math.E);
  assert.equal(compileExpression('e', ['e'])(0, {e: .8}), .8);
  assert.ok(Number.isNaN(compileExpression('1/0')(0)));
  assert.ok(Number.isNaN(compileExpression('missing')(0)));
});
test('rejects JavaScript and malformed math', () => {
  for (const expression of ['window.location', 'process.exit()', 'constructor(x)', 'x=2', 'sin()', 'pow(2)', 'x;2', 'x[0]']) assert.throws(() => compileExpression(expression));
});
test('sampling bounds and actual sweep values', () => {
  assert.deepEqual(sweepFunction('-x^2', [-2,2], 3).y, [-4, -0, -4]);
  assert.deepEqual(linspace(0, 1, 1), [0]);
  for (const n of [0, -1, 1.5, Infinity, 100001]) assert.throws(() => linspace(0,1,n));
});
test('late subscribers see immutable current snapshots', () => {
  store.registerParameter('late', 'gain', 7);
  const before = store.getScopeSnapshot('late');
  assert.equal(before.gain, 7);
  assert.equal(before, store.getScopeSnapshot('late'));
  let calls = 0;
  const unsubscribe = store.subscribeParameter('late', () => calls++);
  store.setParameter('late', 'gain', 8);
  store.setParameter('late', 'gain', 8);
  assert.equal(calls, 1);
  assert.equal(before.gain, 7);
  assert.equal(store.getScopeSnapshot('late').gain, 8);
  unsubscribe(); store.destroyScope('late');
});
test('subscription before registration cannot override defaults', () => {
  const off = store.subscribeParameter('early', 'gain', () => {});
  assert.equal(store.getParameter('early', 'gain'), undefined);
  store.registerParameter('early','gain',12);
  assert.equal(store.getParameter('early','gain'),12);
  off(); store.destroyScope('early');
});
test('logarithmic extents and interactions stay in log space', () => {
  assert.deepEqual(axisExtent([-5, 0, 1, 10, NaN], 'log'), [1,10]);
  assert.deepEqual(axisExtent([0], 'log'), [1,10]);
  const pan = panRange(1,100, .5, 'log');
  assert.ok(Math.abs(pan[0]-10)<1e-10); assert.ok(Math.abs(pan[1]-1000)<1e-9);
  const zoom = zoomRange(1,100,10,.5,'log');
  assert.ok(Math.abs(zoom[0]-Math.sqrt(10))<1e-10);
  assert.ok(Math.abs(zoom[1]-Math.sqrt(1000))<1e-10);
  assert.deepEqual(zoomRange(0,10,5,.5,'linear'),[2.5,7.5]);
});
