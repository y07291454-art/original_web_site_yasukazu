(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NBA_EXPLORE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const metrics = {
    PTS: ['得点', '点'], REB: ['リバウンド', '本'], AST: ['アシスト', '本'],
    STL: ['スティール', '本'], BLK: ['ブロック', '本'], MIN: ['出場時間', '分'],
    FGA: ['FG試投数', '本'], FG3A: ['3P試投数', '本'], FG_PCT: ['FG成功率', '%'],
    FG3_PCT: ['3P成功率', '%'], FT_PCT: ['FT成功率', '%']
  };
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const normalize = x => String(x ?? '').normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').replace(/[\u30a1-\u30f6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/[\s・.\-–—'’#]/g, '');
  const record = (stats, id, season) => stats?.seasons.find(s => s.id === season)?.players[String(id)] || null;
  const cm = height => {const parts = String(height).split('-').map(Number); return parts.length === 2 && parts.every(Number.isFinite) ? Math.round((parts[0]*12+parts[1])*2.54) : null;};
  const eligible = r => !!r && r.GP >= 10 && r.MIN >= 10;
  const population = (data, stats, season, position = '') => data.players.map(p => ({player:p, stats:record(stats,p.id,season)})).filter(x => eligible(x.stats) && (!position || x.player.position.includes(position)));
  function filterPlayers(data, stats, options = {}) {
    const season = options.season || stats.seasons[0].id;
    const query = normalize(options.query);
    const metric = Object.hasOwn(metrics,options.metric) ? options.metric : 'PTS';
    const result = data.players.map(player => ({player,stats:record(stats,player.id,season)})).filter(({player,stats:r}) => {
      const team = data.teams.find(t => t.id === player.team_id);
      if (query && !normalize([player.name,player.jp,player.number,...(player.aliases||[]),team?.name,team?.jp,team?.abbreviation,team?.home_city,...(team?.aliases||[])].join(' ')).includes(query)) return false;
      if (options.team && String(player.team_id)!==String(options.team)) return false;
      if (options.position && !player.position.includes(options.position)) return false;
      const height = cm(player.height);
      if (options.minHeight && (height===null || height < options.minHeight)) return false;
      if (options.maxHeight && (height===null || height > options.maxHeight)) return false;
      if (!r) return !!options.includeMissing && !Number(options.minPoints) && !Number(options.minThrees) && !Number(options.minGames);
      if (r.GP < Number(options.minGames || 0) || r.PTS < Number(options.minPoints || 0) || r.FG3A < Number(options.minThrees || 0)) return false;
      if (metric==='FG3_PCT' && r.FG3A<1) return false;
      if (metric==='FG_PCT' && r.FGA<1) return false;
      if (metric==='FT_PCT' && r.FTA<1) return false;
      return true;
    });
    return result.sort((a,b) => (b.stats?.[metric]??-Infinity)-(a.stats?.[metric]??-Infinity) || (b.stats?.GP??0)-(a.stats?.GP??0) || a.player.name.localeCompare(b.player.name));
  }
  function ranking(rows, id, key) {
    const selected = rows.find(x => String(x.player.id)===String(id));
    if (!selected || !finite(selected.stats[key])) return null;
    const values = rows.map(x=>x.stats[key]).filter(finite);
    const value = selected.stats[key];
    const below = values.filter(x=>x<value).length;
    const tied = values.filter(x=>x===value).length;
    return {value,rank:1+values.filter(x=>x>value).length,total:values.length,percentile:values.length<2?50:100*(below+(tied-1)/2)/(values.length-1)};
  }
  function similar(data, stats, id, season, count=3) {
    const player=data.players.find(p=>String(p.id)===String(id));
    const target=record(stats,id,season);
    if (!player || !eligible(target)) return [];
    const keys=['PTS','REB','AST','STL','BLK','FG3A'];
    const rows=population(data,stats,season);
    const vector = r => keys.map(key=>r[key]*36/r.MIN);
    const vectors=rows.map(x=>vector(x.stats));
    const deviations=keys.map((_,i)=>{
      const mean=vectors.reduce((sum,v)=>sum+v[i],0)/Math.max(1,vectors.length);
      return Math.sqrt(vectors.reduce((sum,v)=>sum+(v[i]-mean)**2,0)/Math.max(1,vectors.length))||1;
    });
    const targetVector=vector(target);
    return rows.filter(x=>x.player.id!==player.id && [...player.position].some(p=>'GFC'.includes(p)&&x.player.position.includes(p))).map(x=>{
      const v=vector(x.stats);
      return {...x,distance:Math.sqrt(v.reduce((sum,n,i)=>sum+((n-targetVector[i])/deviations[i])**2,0))};
    }).sort((a,b)=>a.distance-b.distance||a.player.name.localeCompare(b.player.name)).slice(0,count);
  }
  function cleanSelection(value, validIds, max=2) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(String))].filter(id=>validIds.has(id)).slice(0,max);
  }
  function nextGames(schedule, teamId='', now=Date.now(), limit=5) {
    return (schedule?.games||[]).filter(game=>Date.parse(game.start_utc)>now && game.status!==3 && !game.postponed && (!teamId || String(game.home_team_id)===String(teamId) || String(game.away_team_id)===String(teamId))).sort((a,b)=>Date.parse(a.start_utc)-Date.parse(b.start_utc)).slice(0,limit);
  }
  function japanTime(iso) {
    if (!Number.isFinite(Date.parse(iso))) return '開始時刻未定';
    return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));
  }
  function calendarICS(game, title) {
    const date=new Date(game.start_utc);
    if (!Number.isFinite(+date)) return '';
    const stamp=x=>x.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const escape=x=>String(x).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const fold=line=>{let output='',length=0;for(const char of line){const point=char.codePointAt(0),bytes=point>65535?4:point>2047?3:point>127?2:1;if(length+bytes>75){output+='\r\n ';length=1;}output+=char;length+=bytes;}return output;};
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NBA Teams and Players//Schedule//JA','BEGIN:VEVENT',`UID:nba-${game.id}@nba-teams-players`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(date)}`,`DTEND:${stamp(new Date(+date+3*3600000))}`,`SUMMARY:${escape(title)}`,'DESCRIPTION:NBA公式日程の取得時点の予定です。開始時刻は変更される場合があります。','END:VEVENT','END:VCALENDAR',''].map(fold).join('\r\n');
  }
  function shotZone(shot) {
    const [x,y,,value]=shot;
    // LOC_Y is relative to the hoop; the SVG's y=142 corner join includes +52.5 baseline offset.
    if (value===3) return Math.abs(x)>=220 && y<=89.5 ? 'corner3' : 'above3';
    if (Math.hypot(x,y)<=40) return 'rim';
    if (Math.abs(x)<=80 && y>=-52.5 && y<=137.5) return 'paint';
    return 'mid';
  }
  function shotSummary(shots) {
    const groups={all:{attempts:0,made:0},rim:{attempts:0,made:0},paint:{attempts:0,made:0},mid:{attempts:0,made:0},corner3:{attempts:0,made:0},above3:{attempts:0,made:0}};
    for(const shot of shots){if(!Array.isArray(shot)||shot.length<4||!finite(shot[0])||!finite(shot[1])||![0,1].includes(shot[2])||![2,3].includes(shot[3]))continue;for(const key of ['all',shotZone(shot)]){groups[key].attempts++;groups[key].made+=shot[2];}}
    return groups;
  }
  return {metrics,finite,normalize,record,cm,eligible,population,filterPlayers,ranking,similar,cleanSelection,nextGames,japanTime,calendarICS,shotZone,shotSummary};
});
