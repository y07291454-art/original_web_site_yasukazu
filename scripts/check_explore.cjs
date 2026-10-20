/* Data and behavior checks for player discovery; no browser or dependencies needed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../assets/js/explore-core.js');
const root=path.resolve(__dirname,'..');
const json=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const data=json('assets/data/nba.json'),stats=json('assets/data/player-stats.json');
const schedule=json('assets/data/schedule.json'),index=json('assets/data/shot-chart-index.json');
const ids=new Set(data.players.map(p=>String(p.id)));
assert.deepEqual(core.cleanSelection(['201939',201939,'invalid',null,'2544','203999'],ids),['201939','2544']);
assert.deepEqual(core.cleanSelection({},ids),[]);
const curry=core.filterPlayers(data,stats,{query:'Ｃｕｒｒｙ',minGames:10});
assert.ok(curry.some(x=>x.player.id===201939));
assert.deepEqual(core.filterPlayers(data,stats,{query:'no such NBA player 58392'}),[]);
for(const season of stats.seasons){
  const matched=core.filterPlayers(data,stats,{season:season.id,minGames:10,minThrees:5,position:'G',metric:'FG3A'});
  assert.ok(matched.length>0);
  for(const x of matched)assert.ok(x.player.position.includes('G')&&x.stats.GP>=10&&x.stats.FG3A>=5);
  assert.ok(matched.every((x,i)=>!i||x.stats.FG3A<=matched[i-1].stats.FG3A));
  const percentage=core.filterPlayers(data,stats,{season:season.id,metric:'FG3_PCT'});
  assert.ok(percentage.every(x=>x.stats.FG3A>=1));
  const pop=core.population(data,stats,season.id);
  for(const row of pop){
    const rank=core.ranking(pop,row.player.id,'PTS');
    assert.ok(rank.rank>=1&&rank.rank<=pop.length&&rank.percentile>=0&&rank.percentile<=100);
    const similar=core.similar(data,stats,row.player.id,season.id);
    assert.ok(similar.length<=3&&similar.every(x=>x.player.id!==row.player.id&&core.eligible(x.stats)&&Number.isFinite(x.distance)));
    assert.equal(new Set(similar.map(x=>x.player.id)).size,similar.length);
  }
  assert.equal(index.coverage[season.id].official_totals_verified,true);
  assert.deepEqual(Object.keys(index.players[season.id]).sort(),Object.keys(season.players).sort());
  for(const [id,entry]of Object.entries(index.players[season.id])){
    const payload=json(entry.path);
    assert.equal(String(payload.player_id),id);assert.equal(payload.season,season.id);
    const summary=core.shotSummary(payload.shots);
    assert.equal(summary.all.attempts,entry.attempts);assert.equal(summary.all.made,entry.made);
    assert.equal(Object.entries(summary).filter(([key])=>key!=='all').reduce((sum,[,r])=>sum+r.attempts,0),entry.attempts);
    assert.ok(summary.all.made<=summary.all.attempts);
    const r=season.players[id];
    assert.ok(Math.abs(r.FGA-entry.attempts/r.GP)<=0.0500001);
    assert.ok(Math.abs(r.FGM-entry.made/r.GP)<=0.0500001);
  }
}
const fake=[{player:{id:1},stats:{PTS:20}},{player:{id:2},stats:{PTS:20}},{player:{id:3},stats:{PTS:10}}];
assert.deepEqual(core.ranking(fake,1,'PTS'),{value:20,rank:1,total:3,percentile:75});
assert.equal(core.ranking(fake,3,'PTS').rank,3);
assert.equal(core.ranking(fake,99,'PTS'),null);
assert.equal(core.shotZone([0,0,1,2]),'rim');
assert.equal(core.shotZone([60,100,0,2]),'paint');
assert.equal(core.shotZone([100,200,0,2]),'mid');
assert.equal(core.shotZone([-230,50,1,3]),'corner3');
assert.equal(core.shotZone([230,120,1,3]),'above3');
assert.equal(core.shotZone([0,260,1,3]),'above3');
assert.equal(core.shotSummary([]).all.attempts,0);
assert.ok(core.japanTime('2026-10-20T19:00:00Z').includes('10/21'));
assert.ok(core.japanTime('2026-10-20T19:00:00Z').includes('04:00'));
const upcoming=core.nextGames(schedule,'',Date.parse('2026-10-20T10:00:00Z'),2000);
assert.ok(upcoming.length>1000&&upcoming.every(g=>Date.parse(g.start_utc)>Date.parse('2026-10-20T10:00:00Z')));
for(const t of data.teams){
  const games=core.nextGames(schedule,t.id,Date.parse('2026-10-20T10:00:00Z'),100);
  assert.ok(games.length>=78&&games.every(g=>[g.home_team_id,g.away_team_id].includes(t.id)));
}
const game={id:'test',start_utc:'2026-10-20T19:00:00Z',status:1,home_team_id:1,away_team_id:2};
assert.deepEqual(core.nextGames({games:[{...game,postponed:true},{...game,status:3}]},'',Date.parse('2026-10-19')),[]);
const ics=core.calendarICS(game,'A, B; C\nD');
assert.ok(ics.includes('DTSTART:20261020T190000Z\r\n'));
assert.ok(ics.includes('DTEND:20261020T220000Z\r\n'));
assert.ok(ics.includes('SUMMARY:A\\, B\\; C\\nD'));
assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));
for(const page of ['index.html',...data.teams.map(t=>t.page)]){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 assert.ok(!html.includes('player-stats-data.js'),'Large stats data must not load on map/team pages');
 for(const link of ['players.html','compare.html','favorites.html','schedule.html'])assert.ok(html.includes(`href="${link}"`));
}
console.log('PASS: discovery filters, real-player similarity, tied percentiles, 1,211 shot files and season totals, JST dates, next games for 30 teams, ICS escaping and asset loading.');
