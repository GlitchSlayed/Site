import { describe, expect, it } from 'vitest';
import { airfoilCoordinates, drawingInfo, drawingSvg } from '../src/lib/drawings';
import { sourceLinks } from '../src/lib/sourceLinks';

describe('technical cover geometry', () => {
 it('keeps the 0012 symmetric with nominal twelve-percent thickness and a closed trailing edge', () => {
  const {upper,lower}=airfoilCoordinates();
  upper.forEach(([x,y],i)=>{expect(x).toBeCloseTo(lower[i][0],12);expect(y).toBeCloseTo(-lower[i][1],12);});
  expect(Math.max(...upper.map((p,i)=>p[1]-lower[i][1]))).toBeCloseTo(.12,3);
  expect(upper.at(-1)![1]).toBeCloseTo(0,12);
 });
 it('places 4412 camber near four percent at forty percent chord', () => {
  const {camber}=airfoilCoordinates(.04);
  const maximum=camber.reduce((a,b)=>b[1]>a[1]?b:a);
  expect(maximum[0]).toBeCloseTo(.4,1);expect(maximum[1]).toBeCloseTo(.04,3);
 });
 it('isolates SVG styling when the same plate appears more than once', () => {
  for(const kind of Object.keys(drawingInfo) as Array<keyof typeof drawingInfo>){
   expect(drawingSvg(kind,'first')).toContain('id="drawing-first"');
   expect(drawingSvg(kind,'second')).not.toContain('#drawing-first');
  }
 });
});
describe('article resource shelf', () => {
 it('deduplicates references and excludes images and non-web schemes', () => {
  expect(sourceLinks('[One](https://example.org/a) [Again](https://example.org/a) ![Image](https://example.org/b.png) [Unsafe](javascript:alert(1))')).toEqual([{href:'https://example.org/a',label:'One',host:'example.org'}]);
 });
});

describe('Markdown resource parsing regressions', () => {
 it('preserves parentheses and resolves reference links', () => {
  const links = sourceLinks('[Airfoil](https://example.org/Airfoil_(wing)) [Report][report]\n\n[report]: https://example.org/report');
  expect(links.map(link => link.href)).toEqual(['https://example.org/Airfoil_(wing)', 'https://example.org/report']);
 });
 it('ignores links written inside code and keeps the first reference definition', () => {
  expect(sourceLinks('`[Code](https://example.org/code)` [One][r]\n\n[r]: https://example.org/first\n[r]: https://example.org/second').map(link => link.href)).toEqual(['https://example.org/first']);
 });
});
