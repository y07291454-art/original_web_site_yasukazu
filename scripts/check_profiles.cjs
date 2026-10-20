/* Exercise the real profile renderer with every checked-in player and team. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/nba.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const helpers = require('../assets/js/filters.js');
const statsData = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/player-stats.json'), 'utf8'));
const statsUI = require('../assets/js/stats.js');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(query, fixed = '') {
  const detail = { dataset: {player: fixed}, innerHTML: '' };
  const selector = {value:statsData.seasons[0].id, listeners:{}, addEventListener(event, listener) { this.listeners[event]=listener; }};
  const metrics = {innerHTML:''};
  const source = {href:''};
  const document = {
    title: '', body: {dataset: {}},
    getElementById: id => ({'player-detail':detail,'stats-season':selector,'player-stats-metrics':metrics,'stats-official-link':source}[id] || null),
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
  };
  vm.runInNewContext(app, {document, window: {NBA_DATA:data, NBA_FILTERS:helpers,NBA_PLAYER_STATS:statsData,NBA_STATS:statsUI}, location:{search:query}, URLSearchParams});
  return {document, detail,selector,metrics,source};
}
for (const player of data.players) {
  const team = data.teams.find(t => t.id === player.team_id);
  const {document, detail,selector,metrics,source} = render(`?id=${player.id}`);
  assert.equal(document.body.dataset.teamTheme, String(team.id));
  assert.equal(document.title, `${player.name} | NBA Teams & Players`);
  assert.ok(detail.innerHTML.includes(`<h1>${escape(player.name)}</h1>`));
  assert.ok(detail.innerHTML.includes(`/1040x760/${player.id}.png`));
  assert.ok(detail.innerHTML.includes(`href="${team.page}"`));
  assert.ok(detail.innerHTML.includes(`src="${team.logo}"`));
  assert.ok(detail.innerHTML.includes('シーズン成績'));
  assert.ok(detail.innerHTML.includes(statsUI.renderMetrics(statsUI.getRecord(statsData,player.id,statsData.seasons[0].id))));
  for (const season of statsData.seasons) {
    selector.value=season.id;selector.listeners.change();
    assert.equal(metrics.innerHTML,statsUI.renderMetrics(statsUI.getRecord(statsData,player.id,season.id)));
    assert.equal(source.href,statsUI.sourceUrl(player.id,season.id));
  }
}
assert.ok(render('?id=unknown').detail.innerHTML.includes('選手を選んでください'));
const kyrie = data.players.find(p => p.slug === 'kyrie-irving');
assert.ok(render('?id=unknown', String(kyrie.id)).detail.innerHTML.includes(`<h1>${escape(kyrie.name)}</h1>`));
console.log(`PASS: ${data.players.length} real profiles, 3-season stats changes and source links, team themes, large portraits, unknown IDs and legacy URL.`);
