import assert from 'node:assert/strict';
import { calculateLayout, removeSelectedCopies } from '../modules/layout.js';
const EPS=1e-5;
const img = (id, w, h, qty=1) => ({id,name:id,qty,width:w,height:h});
const paper = (width,height) => ({width,height});
function state(items, {margin=0,gap=0,layoutMode='ultra',rotation=true}={}) {
  return {items,layoutMode,margin,gap,denseAllowRotation:rotation};
}
function verify(result,sheet,margin,gap) {
  const all=result.pages.flat();
  assert.equal(result.total,all.length+result.tooLarge.length,'preserve all item instances');
  for (const page of result.pages) {
    for (const p of page) {
      assert.ok(p.x >= margin-EPS && p.y >= margin-EPS,`negative margin ${p.id}`);
      assert.ok(p.x+p.width <= sheet.width-margin+EPS, `out of right edge ${p.id}`);
      assert.ok(p.y+p.height <= sheet.height-margin+EPS,`out of bottom edge ${p.id}`);
    }
    for (let i=0;i<page.length;i++) for(let j=i+1;j<page.length;j++) {
      const a=page[i],b=page[j];
      const separated = a.x+a.width+gap <= b.x+EPS || b.x+b.width+gap <= a.x+EPS ||
        a.y+a.height+gap <= b.y+EPS || b.y+b.height+gap <= a.y+EPS;
      assert.ok(separated, `overlap/gap: ${a.instanceId} vs ${b.instanceId}`);
    }
  }
}
// A mixed landscape/portrait pair cannot be fitted by row-first layout,
// but fits with physical 90-degree rotation.
let r=calculateLayout(state([img('wide',80,40),img('tall',40,80)],{rotation:true}),paper(80,80));
verify(r,paper(80,80),0,0);
assert.equal(r.pages.length,1);
assert.ok(r.pages[0].some(p=>p.rotated));
const withoutRotation=calculateLayout(state([img('wide',80,40),img('tall',40,80)],{rotation:false}),paper(80,80));
assert.equal(withoutRotation.pages.length,2);
// A portrait-orientation sheet may accept a wide piece when rotated.
r=calculateLayout(state([img('wide',80,40)]),paper(55,90));
assert.equal(r.tooLarge.length,0);
assert.equal(r.pages[0][0].rotated,true);
r=calculateLayout(state([img('wide',80,40)],{rotation:false}),paper(55,90));
assert.equal(r.tooLarge.length,1);
// Dense mode should retain sources, counts, and exact physical dimensions.
r=calculateLayout(state([img('a',60,40,3),img('b',25,55,2)],{margin:4,gap:3}),paper(102,152));
verify(r,paper(102,152),4,3);
assert.equal(r.pages.flat().length,5);
for(const p of r.pages.flat()) {
  const item=p.id==='a'?{width:60,height:40}:{width:25,height:55};
  assert.ok((p.width===item.width && p.height===item.height)||(p.width===item.height && p.height===item.width));
}
const selected = new Set([r.pages.flat()[0].instanceId]);
const deleted=removeSelectedCopies(state([img('a',60,40,3),img('b',25,55,2)]).items,selected);
assert.equal(deleted.removed,1);
const fresh=calculateLayout(state(deleted.items,{margin:4,gap:3}),paper(102,152));
verify(fresh,paper(102,152),4,3);
assert.equal(fresh.pages.flat().length,4);
// Deterministic seeded random datasets: mixed sizes, orientations and page sizes.
let seed=73129;
const rand=()=> {seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let iteration=0; iteration<30; iteration++) {
  const width=iteration%2?102:210,height=iteration%2?152:297;
  const m=iteration%3?4:8,g=iteration%4?2:3;
  const data=Array.from({length:24},(_,i)=>img(`img${i}`,12+Math.floor(rand()*65),12+Math.floor(rand()*80)));
  const got=calculateLayout(state(data,{margin:m,gap:g,rotation:iteration%2===0}),paper(width,height));
  verify(got,paper(width,height),m,g);
}
// Source order remains untouched by any dense arrangement.
const input=[img('z',48,18),img('x',12,55),img('y',35,44)];
const snap=JSON.stringify(input);
calculateLayout(state(input),paper(90,120));
assert.equal(JSON.stringify(input),snap);
// Representative real-mm packing case: 22 mixed stickers on A4.
const mixedDims = [[55,49],[45,48],[74,90],[79,69],[63,44],[46,54],[29,46],
  [58,24],[79,80],[20,75],[67,62],[32,66],[61,50],[30,97],[53,36],
  [30,102],[81,87],[74,53],[80,102],[37,97],[19,71],[64,40]];
const mixedItems=mixedDims.map(([w,h],i)=>img(`mixed${i}`,w,h));
const mixedPaper=paper(210,297);
const compactPages=calculateLayout(state(mixedItems,{margin:8,gap:3,layoutMode:'compact'}),mixedPaper);
const densePages=calculateLayout(state(mixedItems,{margin:8,gap:3}),mixedPaper);
verify(densePages,mixedPaper,8,3);
assert.equal(compactPages.pages.length,3);
assert.equal(densePages.pages.length,2);
console.log('A4 mixed-size comparison: compact 3 sheets / ultra-dense 2 sheets');
console.log('PASS dense MaxRects geometry, rotate, deletion, random cases, source integrity');
