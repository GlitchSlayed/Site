import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = await readFile(new URL('../src/lib/engineering/mdxData.ts', import.meta.url), 'utf8');
const { alignScatterSeries, alignLineSeries, csvCell, compareCells, safePageSize, heatmapError } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
test('scatter preserves independent categories and repeated X observations', () => {
  const series = [{id:'a',label:'A',x:[2,1,1],y:[20,10,12]},{id:'b',label:'B',x:[3],y:[30]}];
  const result = alignScatterSeries(series);
  assert.deepEqual(result.map(s=>s.x), [[1,2,3],[1,2,3],[1,2,3]]);
  assert.deepEqual(result.flatMap(s=>s.y).filter(Number.isFinite).sort((a,b)=>a-b),[10,12,20,30]);
  assert.deepEqual(series[0].x,[2,1,1]);
});
test('line alignment preserves samples without interpolation or input mutation', () => {
  const result = alignLineSeries([{id:'a',label:'A',x:[2,0],y:[4,0]},{id:'b',label:'B',x:[1],y:[7]}]);
  assert.deepEqual(result[0].x,[0,1,2]);
  assert.deepEqual(result[0].y,[0,NaN,4]);
  assert.throws(()=>alignLineSeries([{id:'a',label:'A',x:[1,1],y:[2,3]}]));
  assert.throws(()=>alignScatterSeries([{id:'a',label:'A',x:[1],y:[]}]));
});
test('CSV quotes correctly and neutralizes text formulas without corrupting numeric signs', () => {
  assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
  assert.equal(csvCell('=1+1'),'"\'=1+1"');
  assert.equal(csvCell('  @SUM(A1)'),'"\'  @SUM(A1)"');
  assert.equal(csvCell(-2),'"-2"');
});
test('table helpers handle invalid page sizes and sort missing values consistently', () => {
  assert.equal(safePageSize(0),10); assert.equal(safePageSize(5),5);
  assert.equal(compareCells(null,undefined),0);
  assert.equal(compareCells(NaN,5,true),1);
  assert.ok(compareCells(10,2,true)<0);
});
test('heatmaps distinguish missing cells from invalid shape/ranges', () => {
  assert.equal(heatmapError([[1,NaN],[2,3]],[0,1]),null);
  assert.ok(heatmapError([[1],[2,3]]));
  assert.ok(heatmapError([[1]],[1,1]));
  assert.ok(heatmapError([]));
});
