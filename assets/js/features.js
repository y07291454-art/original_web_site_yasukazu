(function () {
  'use strict';
  const data=window.NBA_DATA, core=window.NBA_EXPLORE, stats=window.NBA_PLAYER_STATS;
  if(!data||!core)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const teams=new Map(data.teams.map(t=>[String(t.id),t]));
  const players=new Map(data.players.map(p=>[String(p.id),p]));
  const playerIds=new Set(players.keys()),teamIds=new Set(teams.keys());
  const portrait=id=>`https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
  const fallback='assets/img/player-placeholder.svg';
  const star='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8L12 17.6l-6.1 3.2L7.1 14 2.2 9.2l6.8-1Z"/></svg>';
  const compareIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 3v18M19 3v18M1 7h8M15 17h8M5 7l4 4M19 17l-4-4"/></svg>';
  const empty=text=>`<div class="empty-state"><p>${esc(text)}</p></div>`;
  const format=(value,key='')=>core.finite(value)?(key.endsWith('_PCT')?(value*100).toFixed(1)+'%':key==='GP'?String(value):value.toFixed(1)):'—';
  const fetchCache=new Map();
  let shotRequest=0;
  const zones={all:'全エリア',rim:'リング付近',paint:'ペイント',mid:'ミドル',corner3:'コーナー3',above3:'その他の3P'};
  const getSeason=()=>$('#stats-season')?.value||$('#explore-season')?.value||stats?.seasons[0].id;
  let storageAvailable=true;
  function readStorage(key,fallbackValue){try{return JSON.parse(localStorage.getItem(key)||'null')??fallbackValue;}catch{return fallbackValue;}}
  function saveStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{storageAvailable=false;}}
  const rawFavorites=readStorage('nba-favorites-v1',{});
  let favorites={teams:core.cleanSelection(rawFavorites?.teams,teamIds,30),players:core.cleanSelection(rawFavorites?.players,playerIds,data.players.length)};
  let comparison=core.cleanSelection(readStorage('nba-compare-v1',[]),playerIds,2);
  let toastTimer;
  function toast(text,link=''){
    let element=$('#feature-toast');
    if(!element){element=document.createElement('div');element.id='feature-toast';element.className='feature-toast';element.setAttribute('role','status');element.setAttribute('aria-live','polite');document.body.append(element);}
    element.innerHTML=esc(text)+(link?` <a href="${link}">比較を見る →</a>`:'');element.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{element.hidden=true;},5000);
  }
  function favoriteButton(type,id,name,short=false){return `<button class="feature-button" type="button" data-favorite="${type}" data-id="${id}" aria-label="${esc(name)}を推しに保存" aria-pressed="false">${star}<span>${short?'推し':'推しに保存'}</span></button>`;}
  function compareButton(id,name,short=false){return `<button class="feature-button" type="button" data-compare="${id}" aria-label="${esc(name)}を比較に追加" aria-pressed="false">${compareIcon}<span>${short?'比較':'比較に追加'}</span></button>`;}
  function playerActions(p,short=false){return favoriteButton('players',p.id,p.name,short)+compareButton(p.id,p.name,short);}
  function syncButtons(){
    $$('[data-favorite]').forEach(button=>{const saved=favorites[button.dataset.favorite]?.includes(button.dataset.id);button.setAttribute('aria-pressed',String(!!saved));button.setAttribute('aria-label',`${button.dataset.favorite==='teams'?teams.get(button.dataset.id)?.jp:players.get(button.dataset.id)?.name}を${saved?'推しから外す':'推しに保存'}`);const label=button.querySelector('span');if(label)label.textContent=saved?'保存済み':button.closest('.card-tools')?'推し':'推しに保存';});
    $$('[data-compare]').forEach(button=>{const selected=comparison.includes(button.dataset.compare);button.setAttribute('aria-pressed',String(selected));const label=button.querySelector('span');if(label)label.textContent=selected?'追加済み':button.closest('.card-tools')?'比較':'比較に追加';});
    $$('[data-compare-count]').forEach(x=>{x.textContent=`${comparison.length}/2`;});
    $$('[data-favorite-count]').forEach(x=>{x.textContent=String(favorites.teams.length+favorites.players.length);});
    $$('.pin .label').forEach(pin=>{const team=data.teams.find(t=>t.page===pin.getAttribute('href'));pin.classList.toggle('is-favorite',!!team&&favorites.teams.includes(String(team.id)));});
  }
  document.addEventListener('click',event=>{
    const favorite=event.target.closest('[data-favorite]');
    if(favorite){
      const {favorite:type,id}=favorite.dataset;if(!favorites[type]||!(type==='teams'?teamIds:playerIds).has(id))return;
      const exists=favorites[type].includes(id);favorites[type]=exists?favorites[type].filter(x=>x!==id):[...favorites[type],id];saveStorage('nba-favorites-v1',favorites);syncButtons();
      if($('#favorites-content'))renderFavorites();
      toast(storageAvailable?(exists?'推しから外しました':'推しに保存しました'):'このブラウザでは保存できないため、開いている間だけ保持します');
    }
    const compare=event.target.closest('[data-compare]');
    if(compare){
      const id=compare.dataset.compare;if(!playerIds.has(id))return;
      const exists=comparison.includes(id);
      if(!exists&&comparison.length===2){toast('比較は2人まで。比較ページで入れ替えられます。','compare.html');return;}
      comparison=exists?comparison.filter(x=>x!==id):[...comparison,id];saveStorage('nba-compare-v1',comparison);syncButtons();
      toast(exists?'比較から外しました':`${comparison.length}/2人を比較に追加しました`,'compare.html');
    }
    const calendar=event.target.closest('[data-calendar]');
    if(calendar&&scheduleData){
      const game=scheduleData.games.find(g=>String(g.id)===calendar.dataset.calendar);if(!game)return;
      const home=teams.get(String(game.home_team_id)),away=teams.get(String(game.away_team_id));
      const ics=core.calendarICS(game,`${away?.name||'Away'} @ ${home?.name||'Home'}`);
      const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download=`nba-${game.id}.ics`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  });
  window.addEventListener('storage',event=>{
    if(event.key==='nba-favorites-v1'){const raw=readStorage('nba-favorites-v1',{});favorites={teams:core.cleanSelection(raw?.teams,teamIds,30),players:core.cleanSelection(raw?.players,playerIds,data.players.length)};syncButtons();if($('#favorites-content'))renderFavorites();}
    if(event.key==='nba-compare-v1'){comparison=core.cleanSelection(readStorage('nba-compare-v1',[]),playerIds,2);syncButtons();if($('#compare-content'))renderComparison();}
  });
  $$('#team-roster [data-player-id]').forEach(card=>{const p=players.get(card.dataset.playerId);if(!p)return;const actions=document.createElement('div');actions.className='card-tools';actions.innerHTML=playerActions(p,true);card.append(actions);});
  const profile=$('#player-detail');
  const profileId=profile?.dataset.player||new URLSearchParams(location.search).get('id');
  const profilePlayer=profile&&players.get(profileId);
  if(profilePlayer){
    const actions=document.createElement('div');actions.className='feature-actions';actions.innerHTML=playerActions(profilePlayer);$('.player-team-link')?.after(actions);
    const sections=document.createElement('div');sections.id='profile-features';sections.innerHTML=`<nav class="profile-section-nav" aria-label="選手データの表示"><a class="feature-button" href="#player-trends">成績推移</a><a class="feature-button" href="#player-ranks">特徴・順位</a><a class="feature-button" href="#player-shots">シュート</a><a class="feature-button" href="#player-similar">似た選手</a></nav><div class="feature-grid"><section class="feature-panel" id="player-trends" aria-labelledby="trends-title"></section><section class="feature-panel" id="player-ranks" aria-labelledby="ranks-title"></section><section class="feature-panel feature-full" id="player-shots" aria-labelledby="shots-title"></section><section class="feature-panel feature-full" id="player-similar" aria-labelledby="similar-title"></section></div>`;profile.append(sections);
    if(stats){renderTrends();renderRanks();renderSimilar();renderShotShell();$('#stats-season')?.addEventListener('change',()=>{renderRanks();renderSimilar();renderShotShell();});}
  }
  const teamPanel=$('#team-info');
  const teamId=teamPanel?document.body.dataset.teamTheme:'';
  if(teamId&&teams.has(teamId)){
    const team=teams.get(teamId),actions=document.createElement('div');actions.className='feature-actions';actions.innerHTML=favoriteButton('teams',teamId,team.jp);$('.team-heading-copy')?.append(actions);
    const schedule=document.createElement('section');schedule.className='feature-panel team-next-game';schedule.id='team-next-game';schedule.innerHTML='<h2>次の試合</h2><p class="load-state" role="status">日程を読み込み中…</p>';$('.team-tabs')?.before(schedule);
  }
  function miniPlayer(p,r){const team=teams.get(String(p.team_id));return `<a class="mini-player" href="player.html?id=${p.id}"><img src="${portrait(p.id)}" alt="" width="65" height="65" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'"><div><strong>${esc(p.name)}</strong><small>${esc(team?.abbreviation)} · ${esc(p.position)}</small>${r?`<small>PTS ${format(r.PTS)} · REB ${format(r.REB)} · AST ${format(r.AST)}</small>`:''}</div></a>`;}
  function renderTrends(key='PTS'){
    const element=$('#player-trends');if(!element)return;
    const seasons=[...stats.seasons].reverse(),max=Math.max(1,...seasons.map(s=>core.record(stats,profileId,s.id)?.[key]||0));
    const options=['PTS','REB','AST','FGA','FG3A','FG3_PCT'].map(k=>`<option value="${k}"${k===key?' selected':''}>${core.metrics[k][0]}</option>`).join('');
    const chart=seasons.map((s,i)=>{const r=core.record(stats,profileId,s.id),value=r?.[key];const height=core.finite(value)?value/max*124:0,x=65+i*160;return `${r?`<rect class="chart-bar" x="${x}" y="${160-height}" width="70" height="${Math.max(height,1)}" rx="5"/>`:''}<text class="chart-value" x="${x+35}" y="${r?Math.max(22,150-height):100}" text-anchor="middle">${format(value,key)}</text><text x="${x+35}" y="190" text-anchor="middle">${s.id}</text>`;}).join('');
    element.innerHTML=`<div class="feature-heading"><h2 id="trends-title">成績の推移</h2><label>表示する成績<select id="trend-metric">${options}</select></label></div><p class="feature-note">3シーズンを比較 · レギュラーシーズン</p><svg class="trend-chart" viewBox="0 0 520 210" role="img" aria-label="${core.metrics[key][0]}の3シーズンの推移"><title>${core.metrics[key][0]}の推移。記録なしは棒を表示しません。</title><path d="M30 162H495" stroke="#c9dcf035"/>${chart}</svg><div class="feature-table-wrap"><table class="feature-table"><thead><tr><th scope="col">シーズン</th><th scope="col">試合</th><th scope="col">PTS</th><th scope="col">REB</th><th scope="col">AST</th><th scope="col">3PA</th></tr></thead><tbody>${seasons.map(s=>{const r=core.record(stats,profileId,s.id);return `<tr><th scope="row">${s.id}</th>${['GP','PTS','REB','AST','FG3A'].map(k=>`<td>${format(r?.[k],k)}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div><p class="feature-note">試合数以外は1試合平均。記録のないシーズンは「—」。</p>`;
    $('#trend-metric').addEventListener('change',event=>renderTrends(event.target.value));
  }
  function renderRanks(position=''){
    const season=getSeason(),rows=core.population(data,stats,season,position),r=core.record(stats,profileId,season);
    const options=[['','掲載選手全体'],...['G','F','C'].filter(p=>profilePlayer.position.includes(p)).map(p=>[p,`${p}を含む選手`])];
    const keys=['PTS','REB','AST','STL','BLK','FG3A'];
    const body=core.eligible(r)?keys.map(key=>{const rank=core.ranking(rows,profileId,key);return rank?`<div class="rank-row"><div class="rank-label"><span>${core.metrics[key][0]} · ${format(rank.value)}</span><strong>${rank.rank}位 / ${rank.total}人</strong></div><div class="rank-bar" role="img" aria-label="${core.metrics[key][0]} ${rank.rank}位、対象${rank.total}人"><span style="width:${Math.max(1,rank.percentile).toFixed(1)}%"></span></div></div>`:'';}).join(''):empty('このシーズンは出場条件を満たす記録がありません。');
    $('#player-ranks').innerHTML=`<div class="feature-heading"><h2 id="ranks-title">特徴・順位</h2><label>比較する対象<select id="rank-position">${options.map(([value,label])=>`<option value="${value}"${value===position?' selected':''}>${label}</option>`).join('')}</select></label></div><p class="feature-note">${esc(season)} · 当サイト掲載選手の中での位置</p>${body}<p class="feature-note">10試合以上・1試合平均10分以上の${rows.length}人。同値は同順位。棒の長さは同値を考慮した百分位で、大きいほど数値が高いことを示します。リーグ公式ランキングではありません。</p>`;
    $('#rank-position').addEventListener('change',event=>renderRanks(event.target.value));
  }
  function renderSimilar(){
    const season=getSeason(),matches=core.similar(data,stats,profileId,season);
    $('#player-similar').innerHTML=`<h2 id="similar-title">スタッツが近い選手</h2><p class="feature-note">${esc(season)} · 新しい選手を見つけよう</p>${matches.length?`<div class="similar-list">${matches.map(x=>miniPlayer(x.player,x.stats)).join('')}</div>`:empty('このシーズンは比較に使える記録が足りません。')}<p class="feature-note">10試合以上・平均10分以上、共通のポジション表記がある掲載選手が対象。得点・REB・AST・STL・BLK・3P試投数を36分換算し、各指標のばらつきをそろえて距離が近い順に表示。実際のプレースタイルや能力の同一性を示す評価ではありません。カードの数値は1試合平均です。</p>`;
  }
  async function loadJSON(path){if(!fetchCache.has(path))fetchCache.set(path,fetch(path).then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json();}).catch(error=>{fetchCache.delete(path);throw error;}));return fetchCache.get(path);}
  async function renderShotShell(){
    const element=$('#player-shots'),season=getSeason(),request=++shotRequest;
    element.innerHTML=`<h2 id="shots-title">シュートマップ</h2><p class="feature-note">${esc(season)} · 実際のシュート位置</p><div id="shot-content"><p class="load-state" role="status">シュート記録を読み込み中…</p></div>`;
    try{
      const index=await loadJSON('assets/data/shot-chart-index.json');if(request!==shotRequest)return;
      const entry=index.players?.[season]?.[profileId];
      if(!entry){$('#shot-content').innerHTML=empty('このシーズンのシュート位置記録はありません。');return;}
      const payload=await loadJSON(entry.path);if(request!==shotRequest)return;
      if(String(payload.player_id)!==String(profileId)||payload.season!==season||!Array.isArray(payload.shots))throw new Error('Invalid shot data');
      renderShots(payload,'all');
    }catch{
      if(request!==shotRequest)return;
      $('#shot-content').innerHTML=empty('シュート記録を読み込めませんでした。')+'<button class="feature-button" type="button" id="retry-shots">もう一度読み込む</button>';$('#retry-shots').addEventListener('click',renderShotShell);
    }
  }
  function renderShots(payload,zone){
    const all=core.shotSummary(payload.shots),summary=all[zone],filtered=payload.shots.filter(s=>zone==='all'||core.shotZone(s)===zone);
    const plotted=filtered.filter(s=>s[0]>=-250&&s[0]<=250&&s[1]>=-52.5&&s[1]<=417.5),outside=filtered.length-plotted.length;
    const circles=plotted.sort((a,b)=>a[2]-b[2]).map(s=>`<circle class="${s[2]?'shot-made':'shot-missed'}" cx="${(s[0]+250).toFixed(1)}" cy="${(s[1]+52.5).toFixed(1)}" r="${s[2]?3:2.5}"/>`).join('');
    $('#shot-content').innerHTML=`<div class="shot-zones" role="group" aria-label="シュートエリア">${Object.entries(zones).map(([key,label])=>`<button type="button" data-shot-zone="${key}" aria-pressed="${key===zone}">${label}</button>`).join('')}</div><div class="court-layout"><div><svg class="shot-court" viewBox="0 0 500 470" role="img" aria-label="${esc(payload.season)} ${zones[zone]}のシュート。成功${summary.made}本、試投${summary.attempts}本"><title>実際のシュート位置。金色は成功、青色は失敗。</title><g class="court-lines"><path d="M1 1H499V469H1ZM170 0V190H330V0M190 0V190H310V0M30 0V142A237.5 237.5 0 0 0 470 142V0M220 40H280M0 469H500"/><circle cx="250" cy="52.5" r="7.5"/><path d="M190 190a60 60 0 0 0 120 0M210 52.5a40 40 0 0 0 80 0M190 469a60 60 0 0 1 120 0"/></g>${circles}</svg><div class="shot-legend"><span>成功</span><span>失敗</span></div></div><div><h3>${zones[zone]}</h3><p class="shot-totals"><strong>${summary.made.toLocaleString()}</strong> / ${summary.attempts.toLocaleString()} 本 <small>成功 / 試投</small></p><p class="shot-totals">${summary.attempts?(summary.made/summary.attempts*100).toFixed(1)+'%':'—'}</p><div class="feature-table-wrap"><table class="feature-table"><thead><tr><th scope="col">エリア</th><th scope="col">成功 / 試投</th><th scope="col">成功率</th></tr></thead><tbody>${Object.entries(zones).filter(([key])=>key!=='all').map(([key,label])=>{const r=all[key];return `<tr><th scope="row">${label}</th><td>${r.made} / ${r.attempts}</td><td>${r.attempts?(r.made/r.attempts*100).toFixed(1)+'%':'—'}</td></tr>`;}).join('')}</tbody></table></div><p class="feature-note">${esc(payload.season)}・レギュラーシーズン合計。FGのみ（FTを除く）。移籍選手は全所属分を合算。エリアは位置と2点／3点の記録から当サイトで分類しています。${outside?`ハーフコート外の${outside}本は集計に含み、地図上では省略しています。`:''}</p><p class="feature-note">NBA公式位置データ · ${esc(payload.updated_at)}取得</p><a class="feature-button" href="https://www.nba.com/stats/player/${payload.player_id}/shooting?Season=${encodeURIComponent(payload.season)}&amp;SeasonType=Regular%20Season" target="_blank" rel="noopener noreferrer">NBA公式のシュート成績 ↗</a></div></div>`;
    $$('[data-shot-zone]').forEach(button=>button.addEventListener('click',()=>renderShots(payload,button.dataset.shotZone)));
  }
  function cardHTML(p,r,season){
    const team=teams.get(String(p.team_id));return `<article class="card" data-player-id="${p.id}" data-team-theme="${p.team_id}"><a class="card-link" href="player.html?id=${p.id}"><div class="thumb"><div class="jersey">${p.number?'#'+esc(p.number):''}<small>${esc(p.position||'PLAYER')}</small></div><img src="${portrait(p.id)}" alt="${esc(p.name)}" width="260" height="190" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'"></div><div class="card-copy"><h3 class="name">${esc(p.name)}</h3><p class="pos">${esc(p.jp||team?.jp)} · ${esc(team?.abbreviation)}</p>${r?`<dl class="card-stats">${['PTS','REB','AST'].map(k=>`<div><dt>${k}</dt><dd>${format(r[k])}</dd></div>`).join('')}</dl><p class="card-stats-season">${esc(season)} · 1試合平均</p>`:`<p class="card-stats-missing">${esc(season)}：NBA公式記録なし</p>`}<span class="card-action">プロフィール <span aria-hidden="true">→</span></span></div></a><div class="card-tools">${playerActions(p,true)}</div></article>`;
  }
  let explorerLimit=24;
  const explorer=$('#explorer-results');
  function explorerOptions(){const form=$('#explorer-form');return Object.fromEntries(new FormData(form));}
  function renderExplorer(reset=true){
    if(!explorer||!stats)return;if(reset)explorerLimit=24;
    const options=explorerOptions(),rows=core.filterPlayers(data,stats,options),metric=options.metric||'PTS';
    const params=new URLSearchParams();for(const [key,value]of Object.entries(options))if(value!==''&&value!==undefined)params.set(key,value);history.replaceState(null,'',`${location.pathname}?${params}`);
    $('#explorer-count').textContent=`${rows.length}人が該当 · ${Math.min(rows.length,explorerLimit)}人を表示`;
    const extra=metric.endsWith('_PCT')?'成功率順では、その種類を1試合平均1本以上打った選手を表示。':'';
    $('#explorer-scope').textContent=`${options.season} · レギュラーシーズン · 当サイト掲載選手が対象。成績は1試合平均。${extra}`;
    const top=rows.slice(0,10);
    $('#explorer-ranking').innerHTML=top.length?`<div class="feature-table-wrap"><table class="feature-table"><thead><tr><th scope="col">順位・選手</th><th scope="col">${core.metrics[metric][0]}</th><th scope="col">出場</th></tr></thead><tbody>${top.map((x,i)=>{const rank=x.stats?1+rows.filter(y=>(y.stats?.[metric]??-Infinity)>x.stats[metric]).length:'—';return `<tr><th scope="row"><a class="explorer-player-name" href="player.html?id=${x.player.id}"><span>${rank}</span><img src="${portrait(x.player.id)}" alt="" width="42" height="42" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'"><span>${esc(x.player.name)}<small>${esc(teams.get(String(x.player.team_id))?.abbreviation)} · ${esc(x.player.position)}</small></span></a></th><td>${format(x.stats?.[metric],metric)}</td><td>${format(x.stats?.GP,'GP')}</td></tr>`;}).join('')}</tbody></table></div>`:'';
    explorer.innerHTML=rows.length?rows.slice(0,explorerLimit).map(x=>cardHTML(x.player,x.stats,options.season)).join(''):empty('条件に合う選手がいません。試合数や試投数の条件を下げてみてください。');
    $('#explorer-more').hidden=rows.length<=explorerLimit;syncButtons();
  }
  if(explorer&&stats){
    const form=$('#explorer-form'),params=new URLSearchParams(location.search);
    $('#explore-season').innerHTML=stats.seasons.map(s=>`<option value="${s.id}">${s.id}</option>`).join('');
    $('#explore-team').innerHTML='<option value="">全30チーム</option>'+data.teams.map(t=>`<option value="${t.id}">${esc(t.jp)}</option>`).join('');
    for(const control of form.elements){if(control.name&&params.has(control.name)){control.value=params.get(control.name);if(control.tagName==='SELECT'&&!control.value)control.selectedIndex=0;}}
    form.addEventListener('submit',event=>event.preventDefault());let filterTimer;
    form.addEventListener('input',()=>{clearTimeout(filterTimer);filterTimer=setTimeout(()=>renderExplorer(),150);});form.addEventListener('change',()=>renderExplorer());
    $('#explorer-reset').addEventListener('click',()=>{form.reset();renderExplorer();});$('#explorer-more').addEventListener('click',()=>{explorerLimit+=24;renderExplorer(false);});renderExplorer();
  }
  function renderFavorites(){
    const root=$('#favorites-content');if(!root)return;
    const season=stats?.seasons[0].id||'';
    const teamHTML=favorites.teams.map(id=>{const t=teams.get(id);return `<article><a class="mini-player" href="${t.page}"><img src="${t.logo}" alt="" width="48" height="48"><div><strong>${esc(t.jp)}</strong><small>${esc(t.name)}</small></div></a><div class="feature-actions">${favoriteButton('teams',id,t.jp)}</div></article>`;}).join('');
    const playerHTML=favorites.players.map(id=>{const p=players.get(id);return cardHTML(p,core.record(stats,id,season),season);}).join('');
    root.innerHTML=`<section class="feature-panel"><h2>推しチーム <small>${favorites.teams.length}</small></h2>${teamHTML?`<div class="favorite-team-list">${teamHTML}</div>`:empty('チームページの「推しに保存」から追加できます。')}</section><section class="feature-panel"><h2>推し選手 <small>${favorites.players.length}</small></h2>${playerHTML?`<div class="players">${playerHTML}</div>`:empty('選手カードやプロフィールの「推しに保存」から追加できます。')}</section>`;syncButtons();
  }
  if($('#favorites-content'))renderFavorites();
  let compareSeason=stats?.seasons[0].id;
  const compareRoot=$('#compare-content');
  function renderComparison(){
    if(!compareRoot||!stats)return;
    for(let slot=0;slot<2;slot++){
      const p=players.get(comparison[slot]);
      $(`#compare-selected-${slot}`).innerHTML=p?`<img src="${portrait(p.id)}" alt="" width="65" height="65" onerror="this.onerror=null;this.src='${fallback}'"><div><strong><a href="player.html?id=${p.id}">${esc(p.name)}</a></strong><small>${esc(teams.get(String(p.team_id))?.abbreviation)} · ${esc(p.position)}</small></div><button type="button" data-remove-slot="${slot}" aria-label="${esc(p.name)}を比較から外す">選び直す</button>`:'<p class="feature-note">上の検索から選手を選んでください。</p>';
    }
    const params=new URLSearchParams();if(comparison[0])params.set('a',comparison[0]);if(comparison[1])params.set('b',comparison[1]);params.set('season',compareSeason);history.replaceState(null,'',`${location.pathname}?${params}`);
    $('#compare-share-url').value=location.href;syncButtons();
    if(comparison.length<2){compareRoot.innerHTML=empty('2人を選ぶと、同じシーズンの成績を並べて比較できます。');bindRemove();return;}
    const records=comparison.map(id=>core.record(stats,id,compareSeason));
    const row=(label,key,percent=false)=>{const values=records.map(r=>r?.[key]);return `<tr><th scope="row">${label}</th>${values.map((value,i)=>`<td${core.finite(value)&&core.finite(values[1-i])&&value>values[1-i]?' class="higher"':''}>${format(value,percent?key:key==='GP'?'GP':'')}</td>`).join('')}</tr>`;};
    const shooting=(label,made,attempts,pct)=>`<tr><th scope="row">${label}<small>成功 / 試投</small></th>${records.map(r=>`<td>${format(r?.[made])} / ${format(r?.[attempts])}<small>${format(r?.[pct],pct)}</small></td>`).join('')}</tr>`;
    compareRoot.innerHTML=`<div class="feature-table-wrap"><table class="feature-table comparison"><thead><tr><th scope="col">${esc(compareSeason)}</th>${comparison.map(id=>`<th scope="col">${esc(players.get(id).name)}</th>`).join('')}</tr></thead><tbody>${row('出場試合','GP')}${row('出場時間','MIN')}${row('得点','PTS')}${row('リバウンド','REB')}${row('アシスト','AST')}${row('スティール','STL')}${row('ブロック','BLK')}${row('ターンオーバー','TOV')}<tr class="section-label"><th colspan="3">シュート · 1試合平均（本）</th></tr>${shooting('FG','FGM','FGA','FG_PCT')}${shooting('3P','FG3M','FG3A','FG3_PCT')}${shooting('FT','FTM','FTA','FT_PCT')}</tbody></table></div><p class="feature-note">レギュラーシーズン。出場試合数・成功率以外は1試合平均。金色は数値が大きい項目で、優劣の総合評価ではありません。記録なしは「—」。移籍選手はシーズンの全所属合計。</p>${records.map((r,i)=>!r?`<p class="feature-note">${esc(players.get(comparison[i]).name)}：${esc(compareSeason)}のNBA公式記録なし。</p>`:'').join('')}`;bindRemove();
  }
  function bindRemove(){
    $$('[data-remove-slot]').forEach(button=>button.addEventListener('click',()=>{const slot=Number(button.dataset.removeSlot);comparison.splice(slot,1);saveStorage('nba-compare-v1',comparison);renderComparison();$(`#compare-query-${Math.min(slot,comparison.length)}`).focus();}));
  }
  if(compareRoot&&stats){
    const params=new URLSearchParams(location.search),fromURL=core.cleanSelection([params.get('a'),params.get('b')],playerIds,2);
    if(params.has('a')||params.has('b')){comparison=fromURL;saveStorage('nba-compare-v1',comparison);}
    if(stats.seasons.some(s=>s.id===params.get('season')))compareSeason=params.get('season');
    $('#compare-season').innerHTML=stats.seasons.map(s=>`<option value="${s.id}"${s.id===compareSeason?' selected':''}>${s.id}</option>`).join('');
    $('#compare-season').addEventListener('change',event=>{compareSeason=event.target.value;renderComparison();});
    for(let slot=0;slot<2;slot++){
      const input=$(`#compare-query-${slot}`),results=$(`#compare-matches-${slot}`);
      input.addEventListener('input',()=>{
        const query=core.normalize(input.value);if(!query){results.replaceChildren();return;}
        const matches=data.players.filter(p=>core.normalize(p.name+' '+p.jp).includes(query)).slice(0,6);
        results.innerHTML=matches.length?matches.map(p=>`<button class="compare-match" type="button" data-pick="${p.id}">${esc(p.name)}<small>${esc(teams.get(String(p.team_id))?.abbreviation)} · ${esc(p.position)}</small></button>`).join(''):'<p class="feature-note">選手が見つかりません。</p>';
        results.querySelectorAll('[data-pick]').forEach(button=>button.addEventListener('click',()=>{
          const id=button.dataset.pick,other=comparison[1-slot];
          if(other===id){toast('もう1人とは別の選手を選んでください。');return;}
          if(slot===1&&!comparison[0]){comparison=[id];}else comparison[slot]=id;
          comparison=core.cleanSelection(comparison,playerIds,2);saveStorage('nba-compare-v1',comparison);input.value='';results.replaceChildren();renderComparison();toast(`${players.get(id).name}を選びました`);
        }));
      });
    }
    $('#copy-compare-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('比較ページのリンクをコピーしました');}catch{$('#compare-share-details').open=true;$('#compare-share-url').select();toast('表示されたリンクをコピーしてください');}});renderComparison();
  }
  let scheduleData;
  function gameCard(game){
    const home=teams.get(String(game.home_team_id)),away=teams.get(String(game.away_team_id));if(!home||!away)return '';
    const team=(t,side)=>`<a class="game-team" href="${t.page}"><img src="${t.logo}" alt="" width="42" height="42"><span><strong>${esc(t.jp)}</strong><small>${side} · ${esc(t.abbreviation)}</small></span></a>`;
    return `<article class="game-card"><p class="game-date"><time datetime="${esc(game.start_utc)}">${game.time_tba?'時刻未定 · '+esc(core.japanTime(game.start_utc).split(' ')[0]):esc(core.japanTime(game.start_utc))}</time>${game.postponed?' · 延期':''}</p><div class="game-teams">${team(away,'AWAY')}<span class="game-versus">VS</span>${team(home,'HOME')}</div><div class="game-bottom"><p>${esc(game.arena||'')} ${esc(game.label||'')}</p>${!game.time_tba&&!game.postponed?`<button class="feature-button" type="button" data-calendar="${esc(game.id)}">カレンダーに追加</button>`:''}</div></article>`;
  }
  function renderSchedule(){
    const selected=$('#schedule-team')?.value||'',month=$('#schedule-month')?.value||'';
    let games=core.nextGames(scheduleData,selected,Date.now(),2000);
    if(month)games=games.filter(g=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date(g.start_utc))===month);
    const limit=Number($('#schedule-results').dataset.limit||30);
    $('#schedule-count').textContent=`今後の${games.length}試合 · 日本時間（JST）`;
    $('#schedule-results').innerHTML=games.length?games.slice(0,limit).map(gameCard).join(''):empty('取得済みの日程に、条件に合う今後の試合はありません。');
    $('#schedule-more').hidden=games.length<=limit;
  }
  async function initializeSchedule(){
    if(!$('#team-next-game')&&!$('#schedule-results'))return;
    try{
      scheduleData=await loadJSON('assets/data/schedule.json');if(!Array.isArray(scheduleData.games))throw new Error('Invalid schedule');
      const date=String(scheduleData.updated_at).slice(0,10);
      if($('#team-next-game')){
        const next=core.nextGames(scheduleData,teamId,Date.now(),1);
        $('#team-next-game').innerHTML=`<div class="feature-heading"><h2>次の試合 <small>${esc(scheduleData.season)}</small></h2><a class="feature-button" href="schedule.html?team=${teamId}">日程を見る →</a></div>${next.length?gameCard(next[0]):empty('取得済みの日程に、今後の試合はありません。')}<p class="feature-note">日本時間 · ${esc(date)}取得時点の予定。公式の日程変更は反映されない場合があります。</p>`;
      }
      if($('#schedule-results')){
        const params=new URLSearchParams(location.search);$('#schedule-team').innerHTML='<option value="">全30チーム</option>'+data.teams.map(t=>`<option value="${t.id}">${esc(t.jp)}</option>`).join('');
        if(teamIds.has(params.get('team')))$('#schedule-team').value=params.get('team');
        const months=[...new Set(scheduleData.games.filter(g=>Date.parse(g.start_utc)>Date.now()).map(g=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date(g.start_utc))))].sort();
        $('#schedule-month').innerHTML='<option value="">すべての月</option>'+months.map(m=>`<option value="${m}">${m.replace('-','年')}月</option>`).join('');
        $('#schedule-source').textContent=`${scheduleData.season} · NBA公式日程 · ${scheduleData.updated_at}取得。開始時刻は変更される場合があります。スコア速報ではありません。`;
        for(const selector of ['#schedule-team','#schedule-month'])$(selector).addEventListener('change',()=>{$('#schedule-results').dataset.limit='30';renderSchedule();});
        $('#schedule-more').addEventListener('click',()=>{$('#schedule-results').dataset.limit=String(Number($('#schedule-results').dataset.limit||30)+30);renderSchedule();});renderSchedule();
      }
    }catch{
      const html=empty('日程を読み込めませんでした。')+'<a class="feature-button" href="https://www.nba.com/schedule" target="_blank" rel="noopener noreferrer">NBA公式の日程を見る ↗</a>';
      if($('#team-next-game'))$('#team-next-game').innerHTML=html;if($('#schedule-results'))$('#schedule-results').innerHTML=html;
    }
  }
  initializeSchedule();syncButtons();
})();
