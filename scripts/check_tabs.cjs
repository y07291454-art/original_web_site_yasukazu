/* Run the actual page enhancement and exercise mouse and keyboard tab changes. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/nba.json'), 'utf8'));
const helpers = require('../assets/js/filters.js');
let focused = null;
const makeTab = name => ({
  dataset: {teamTab: name}, attributes: {'aria-controls':`team-${name}`, 'aria-selected':'false'}, listeners: {},
  getAttribute(key) { return this.attributes[key]; },
  setAttribute(key, value) { this.attributes[key] = value; },
  addEventListener(event, listener) { this.listeners[event] = listener; },
  focus() { focused = this; },
});
const tabs = ['info', 'players'].map(makeTab);
const panels = {'team-info':{hidden:false}, 'team-players':{hidden:false}};
const group = {hidden:true, querySelectorAll:()=>tabs};
const document = {
  body:{dataset:{}},
  querySelector:selector=>selector==='[data-team-tabs]' ? group : null,
  querySelectorAll:()=>[], getElementById:id=>panels[id] || null, addEventListener() {},
};
vm.runInNewContext(app, {document, window:{NBA_DATA:data, NBA_FILTERS:helpers}, location:{search:''}, URLSearchParams});
function selected(index) {
  tabs.forEach((tab, i) => {
    assert.equal(tab.attributes['aria-selected'], String(i===index));
    assert.equal(tab.tabIndex, i===index ? 0 : -1);
    assert.equal(panels[tab.attributes['aria-controls']].hidden, i!==index);
  });
}
function press(index, key) {
  let prevented = false;
  tabs[index].listeners.keydown({key, preventDefault() { prevented = true; }});
  return prevented;
}
assert.equal(group.hidden, false);
selected(1);
tabs[0].listeners.click(); selected(0);
assert.ok(press(0,'ArrowLeft')); selected(1); assert.equal(focused,tabs[1]);
assert.ok(press(1,'ArrowRight')); selected(0); assert.equal(focused,tabs[0]);
assert.ok(press(0,'End')); selected(1);
assert.ok(press(1,'Home')); selected(0);
assert.equal(press(0,'Tab'),false); selected(0);
for (const team of data.teams) {
  const html = fs.readFileSync(path.join(root,team.page),'utf8');
  for (const id of ['team-tabs','team-tab-info','team-tab-players','team-info','team-players']) {
    assert.ok(html.includes(id),`${team.page}: ${id}`);
  }
  assert.ok(!/id="team-(?:info|players)"[^>]*\bhidden\b/.test(html), `${team.page}: content available without JS`);
  assert.ok(html.includes('<details class="roster-refine">'));
}
console.log('PASS: default roster, click/arrow/Home/End navigation, focus and ARIA state; all 30 teams retain both panels without JS.');
