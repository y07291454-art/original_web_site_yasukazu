/* Exercise the real profile renderer with every checked-in player and team. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/nba.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const helpers = require('../assets/js/filters.js');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(query, fixed = '') {
  const detail = { dataset: {player: fixed}, innerHTML: '' };
  const document = {
    title: '', body: {dataset: {}},
    getElementById: id => id === 'player-detail' ? detail : null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
  };
  vm.runInNewContext(app, {document, window: {NBA_DATA:data, NBA_FILTERS:helpers}, location:{search:query}, URLSearchParams});
  return {document, detail};
}
for (const player of data.players) {
  const team = data.teams.find(t => t.id === player.team_id);
  const {document, detail} = render(`?id=${player.id}`);
  assert.equal(document.body.dataset.teamTheme, String(team.id));
  assert.equal(document.title, `${player.name} | NBA Teams & Players`);
  assert.ok(detail.innerHTML.includes(`<h1>${escape(player.name)}</h1>`));
  assert.ok(detail.innerHTML.includes(`/1040x760/${player.id}.png`));
  assert.ok(detail.innerHTML.includes(`href="${team.page}"`));
  assert.ok(detail.innerHTML.includes(`src="${team.logo}"`));
}
assert.ok(render('?id=unknown').detail.innerHTML.includes('選手を選んでください'));
const kyrie = data.players.find(p => p.slug === 'kyrie-irving');
assert.ok(render('?id=unknown', String(kyrie.id)).detail.innerHTML.includes(`<h1>${escape(kyrie.name)}</h1>`));
console.log(`PASS: ${data.players.length} real profiles, team themes/links, large portraits, unknown IDs and legacy profile URL.`);
