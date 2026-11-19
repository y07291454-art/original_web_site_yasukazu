#!/usr/bin/env node
// Verify conference filter behavior with the actual generated markup and NBA data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname,'..');
const read = (file) => fs.readFileSync(path.join(root,file),'utf8');
const page = read('index.html');
const clubs = JSON.parse(read('assets/data/nba.json')).teams;
const pins = [...page.matchAll(/class="pin pin-([^"]+)" data-conference="(East|West)"/g)].map(([,slug,name])=>({ slug, hidden:false, dataset:{conference:name} }));
assert.equal(pins.length,30);
assert.equal(new Set(pins.map(pin=>pin.slug)).size,30);
pins.forEach(pin=>assert.equal(clubs.find(t=>t.pin===pin.slug).conference,pin.dataset.conference));
const buttons = [...page.matchAll(/data-arena-filter="(all|East|West)" aria-pressed="(true|false)" aria-controls="arena-map"/g)].map(([,id,initial])=>({
  dataset:{arenaFilter:id},
  pressed:initial,
  addEventListener(type,callback) { assert.equal(type,'click'); this.click=callback; },
  setAttribute(attr,value) { assert.equal(attr,'aria-pressed'); this.pressed=value; }
}));
const status = {textContent:'30チームを表示中'};
const filters = {hidden:true,querySelectorAll:()=>buttons};
const JS = read('assets/js/arena-atlas.js');
vm.runInNewContext(JS, {document:{
  querySelector: (s)=>s==='[data-arena-filters]'? filters : status,
  querySelectorAll: ()=>pins
}});
assert.equal(filters.hidden,false);
for (const [name,n,prefix] of [['East',15,'東：'],['West',15,'西：'],['all',30,''],['East',15,'東：']]){
  const control = buttons.find(b=>b.dataset.arenaFilter===name);
  control.click();
  assert.equal(buttons.filter(b=>b.pressed==='true').length,1);
  assert.equal(control.pressed,'true');
  assert.equal(pins.filter(pin=>!pin.hidden).length,n);
  assert.equal(status.textContent,`${prefix}${n}チームを表示中`);
  assert.ok(pins.every(pin=>pin.hidden===(name!=='all'&&pin.dataset.conference!==name)));
}
assert.match(page,/data-arena-filters role="group"[^>]+ hidden/);
assert.match(read('assets/css/arena-atlas.css'),/\.map-frame \.pin\[hidden\] \{ display:none; \}/);
assert.match(read('assets/css/arena-atlas.css'),/prefers-reduced-motion:reduce/);
console.log('PASS: generated 30 pins match conference data; East/West/All; one selected state; count; harmless with missing UI.');
vm.runInNewContext(JS, {document:{querySelector:()=>null,querySelectorAll:()=>[]}});
