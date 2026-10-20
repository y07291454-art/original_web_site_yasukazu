(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NBA_STATS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (value, percent = false, integer = false) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return integer ? String(value) : (value * (percent ? 100 : 1)).toFixed(1) + (percent ? '%' : '');
  };
  const getRecord = (data, playerId, seasonId) => data.seasons.find(s => s.id === seasonId)?.players[String(playerId)] || null;
  const sourceUrl = (playerId, seasonId) => `https://www.nba.com/stats/player/${encodeURIComponent(playerId)}/traditional?Season=${encodeURIComponent(seasonId)}&SeasonType=Regular%20Season&PerMode=PerGame`;
  function renderMetrics(record) {
    if (!record) return '<div class="stats-empty"><p>このシーズンのNBA公式記録はありません。</p><span>別のシーズンも選べます。</span></div>';
    const cell = (key, label, short, percent = false, integer = false) => `<div><dt>${label}<small>${short}</small></dt><dd>${number(record[key], percent, integer)}</dd></div>`;
    return `<dl class="stats-primary">${cell('PTS','得点','PTS')}${cell('REB','リバウンド','REB')}${cell('AST','アシスト','AST')}</dl>
      <dl class="stats-secondary">${cell('GP','出場試合','GP',false,true)}${cell('MIN','出場時間','MIN')}${cell('STL','スティール','STL')}${cell('BLK','ブロック','BLK')}${cell('TOV','ターンオーバー','TOV')}${cell('FG_PCT','FG成功率','FG%',true)}${cell('FG3_PCT','3P成功率','3P%',true)}${cell('FT_PCT','FT成功率','FT%',true)}</dl>`;
  }
  function renderSection(data, playerId) {
    const latest = data.seasons[0];
    const options = data.seasons.map(season => `<option value="${esc(season.id)}">${esc(season.id)}</option>`).join('');
    return `<section class="player-stats" aria-labelledby="player-stats-title">
      <div class="stats-header"><div><span class="team-tag">SEASON STATS</span><h2 id="player-stats-title">シーズン成績</h2></div><div class="stats-season"><label for="stats-season">シーズン</label><select id="stats-season">${options}</select></div></div>
      <p class="stats-scope">レギュラーシーズン · 平均値は1試合あたり</p>
      <div id="player-stats-metrics" aria-live="polite" aria-atomic="true">${renderMetrics(getRecord(data,playerId,latest.id))}</div>
      <p class="stats-note">出場試合数・成功率はシーズン成績。移籍選手は当該シーズンの全所属合計。</p>
      <p class="stats-source"><a id="stats-official-link" href="${esc(sourceUrl(playerId,latest.id))}" target="_blank" rel="noopener noreferrer">NBA公式スタッツ ↗</a><span>${esc(data.updated_at)}取得</span></p>
    </section>`;
  }
  return {number, getRecord, sourceUrl, renderMetrics, renderSection};
});
