const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const ui = require('../assets/js/stats.js');
const data = JSON.parse(fs.readFileSync(path.join(root,'assets/data/player-stats.json'),'utf8'));
const roster = JSON.parse(fs.readFileSync(path.join(root,'assets/data/nba.json'),'utf8'));
assert.equal(ui.number(0),'0.0');
assert.equal(ui.number(0,true),'0.0%');
assert.equal(ui.number(0.515,true),'51.5%');
assert.equal(ui.number(60,false,true),'60');
for (const missing of [undefined,null,NaN,Infinity,'20.9']) assert.equal(ui.number(missing),'—');
assert.equal(ui.getRecord(data,'invalid',data.seasons[0].id),null);
assert.ok(ui.renderMetrics(null).includes('公式記録はありません'));
assert.ok(!ui.renderMetrics(null).includes('0.0'));
assert.ok(ui.renderMetrics({FGM:0,FGA:0,FG_PCT:0}).includes('<td>0.0 / 0.0</td><td>0.0%</td>'));
assert.ok(ui.renderMetrics({}).includes('<td>— / —</td><td>—</td>'));
assert.equal(data.per_mode,'PerGame');assert.equal(data.season_type,'Regular Season');
const ids = new Set(roster.players.map(p=>String(p.id)));
for (const season of data.seasons) {
  assert.ok(Object.keys(season.players).length>300);
  for (const [id,record] of Object.entries(season.players)) {
    assert.ok(ids.has(id));assert.ok(Number.isInteger(record.GP) && record.GP>0);
    const html=ui.renderMetrics(record);assert.ok(!html.includes('NaN'));
    for (const field of ['PTS','REB','AST','GP','MIN','STL','BLK','TOV']) assert.ok(html.includes(ui.number(record[field],false,field==='GP')));
    for (const field of ['FG_PCT','FG3_PCT','FT_PCT']) assert.ok(html.includes(ui.number(record[field],true)));
    for (const [made,attempts] of [['FGM','FGA'],['FG3M','FG3A'],['FTM','FTA']]) {
      assert.equal(typeof record[made],'number');assert.equal(typeof record[attempts],'number');
      assert.ok(record[made]<=record[attempts]);
      assert.ok(html.includes(`<td>${ui.number(record[made])} / ${ui.number(record[attempts])}</td>`));
    }
  }
}
for (const team of roster.teams) {
  const html=fs.readFileSync(path.join(root,team.page),'utf8');
  for (const player of roster.players.filter(p=>p.team_id===team.id)) {
    const article=html.split(`data-player-id="${player.id}"`)[1].split('</article>')[0];
    const record=ui.getRecord(data,player.id,data.seasons[0].id);
    if (record) for (const key of ['PTS','REB','AST']) assert.ok(article.includes(`<dd>${ui.number(record[key])}</dd>`));
    else assert.ok(article.includes('公式記録なし'));
  }
}
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/player-stats-data.js'),'utf8'),context);
assert.deepEqual(JSON.parse(JSON.stringify(context.window.NBA_PLAYER_STATS)),data);
for (const page of ['index.html','lakers.html']) assert.ok(!fs.readFileSync(path.join(root,page),'utf8').includes('player-stats-data.js'));
console.log('PASS: official stats snapshot/bundle parity, zero/missing values, percentage formatting, all 30 team card stats, profile-only data loading.');
