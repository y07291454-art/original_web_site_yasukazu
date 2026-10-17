(function () {
  'use strict';
  const data = window.NBA_DATA;
  const helpers = window.NBA_FILTERS;
  if (!data || !helpers) return;
  const { normalize, teamMatches, playerMatches, heightCm, weightKg } = helpers;
  const teamsById = new Map(data.teams.map(team => [String(team.id), team]));
  const fallbackImage = 'assets/img/player-placeholder.svg';
  const portrait = (id, size = '260x190') => `https://cdn.nba.com/headshots/nba/latest/${size}/${id}.png`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // The same search and navigation are available on every page.
  const menuButton = document.querySelector('[data-menu-toggle]');
  const menu = document.getElementById('mobile-menu');
  function closeMenu() {
    if (!menu || !menuButton) return;
    menu.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
  }
  menuButton?.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    menuButton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', event => {
    if (menu && !menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  // Phone maps start with the whole map visible; zoom preserves large tap targets.
  const mapControls = document.querySelector('[data-map-controls]');
  if (mapControls) {
    mapControls.hidden = false;
    const mapButtons = [...mapControls.querySelectorAll('[data-map-view]')];
    const mapScroll = document.querySelector('.map-scroll');
    const help = document.getElementById('map-mobile-help');
    function setMapView(view) {
      const zoomed = view === 'zoom';
      document.body.dataset.mapView = zoomed ? 'zoom' : 'fit';
      mapButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mapView === (zoomed ? 'zoom' : 'fit'))));
      if (mapScroll) {
        if (!zoomed) mapScroll.scrollLeft = 0;
        mapScroll.setAttribute('aria-label', zoomed ? 'NBAチームの地図。左右にスワイプしてチームを選べます' : 'NBA全30チームの本拠地');
      }
      if (help) help.textContent = zoomed ? '← 左右にスワイプしてチームを選ぶ →' : 'ロゴをタップ。選びにくいときは「拡大」。';
    }
    mapButtons.forEach(button => button.addEventListener('click', () => setMapView(button.dataset.mapView)));
    setMapView('fit');
  }

  const dialog = document.getElementById('site-search');
  const input = document.getElementById('site-search-input');
  const results = document.getElementById('search-results');
  const searchStatus = document.getElementById('search-status');
  function resultLink(item, type) {
    const isTeam = type === 'チーム';
    const team = isTeam ? item : teamsById.get(String(item.team_id));
    const link = document.createElement('a');
    link.className = 'search-result';
    link.href = isTeam ? item.page : `player.html?id=${item.id}`;
    const image = document.createElement('img');
    image.src = isTeam ? item.logo : portrait(item.id);
    image.alt = '';
    image.width = 40; image.height = 40;
    image.addEventListener('error', () => { image.src = fallbackImage; }, { once: true });
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = isTeam ? item.jp : item.name;
    const sub = document.createElement('small');
    sub.textContent = isTeam ? item.name : [item.jp, team?.name, item.number ? `#${item.number}` : ''].filter(Boolean).join(' · ');
    copy.append(name, sub);
    const tag = document.createElement('span');
    tag.className = 'result-type'; tag.textContent = type;
    link.append(image, copy, tag);
    return link;
  }
  function search() {
    const query = input.value.trim();
    results.replaceChildren();
    if (!query) { searchStatus.textContent = 'チーム名・略称・選手名で検索できます。'; return; }
    const matchingTeams = data.teams.filter(team => teamMatches(team, query));
    const matchingPlayers = data.players.filter(player => playerMatches(player, query));
    const all = [...matchingTeams.map(item => [item, 'チーム']), ...matchingPlayers.map(item => [item, '選手'])];
    searchStatus.textContent = all.length ? `${all.length}件見つかりました${all.length > 30 ? '（先頭30件を表示）' : ''}` : '該当するチーム・選手が見つかりません。別の表記で試してください。';
    all.slice(0, 30).forEach(([item, type]) => results.append(resultLink(item, type)));
  }
  document.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', () => {
    closeMenu();
    dialog.showModal();
    document.body.classList.add('search-is-open');
    input.focus();
  }));
  document.querySelector('[data-close-search]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog?.addEventListener('close', () => { document.body.classList.remove('search-is-open'); input.value = ''; search(); });
  input?.addEventListener('input', search);

  // Directory: filtering never changes the actual links or removes team data.
  const directory = document.getElementById('team-directory');
  if (directory) {
    const query = document.getElementById('team-filter');
    const division = document.getElementById('division-filter');
    const buttons = [...document.querySelectorAll('[data-conference]')];
    const params = new URLSearchParams(location.search);
    let conference = ['East', 'West'].includes(params.get('conference')) ? params.get('conference') : '';
    function filterDirectory() {
      const ids = new Set(data.teams.filter(team => teamMatches(team, query.value, conference, division.value)).map(team => String(team.id)));
      document.querySelectorAll('[data-team-id]').forEach(card => { card.hidden = !ids.has(card.dataset.teamId); });
      directory.querySelectorAll('.division-section').forEach(section => { section.hidden = !section.querySelector('.team-card:not([hidden])'); });
      document.getElementById('directory-count').textContent = `${ids.size} / 30 チームを表示`;
      document.getElementById('directory-empty').hidden = ids.size !== 0;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.conference === conference)));
    }
    buttons.forEach(button => button.addEventListener('click', () => {
      conference = button.dataset.conference;
      division.value = '';
      filterDirectory();
    }));
    query.addEventListener('input', filterDirectory);
    division.addEventListener('change', filterDirectory);
    document.querySelector('[data-reset-directory]')?.addEventListener('click', () => {
      query.value = ''; division.value = ''; conference = ''; filterDirectory(); query.focus();
    });
    filterDirectory();
  }

  // Team rosters are generated in HTML, so the core content is available without JS.
  const roster = document.getElementById('team-roster');
  if (roster) {
    const query = document.getElementById('roster-filter');
    const position = document.getElementById('position-filter');
    const players = data.players.filter(player => String(player.team_id) === roster.dataset.team);
    function filterRoster() {
      const ids = new Set(players.filter(player => playerMatches(player, query.value, position.value)).map(player => String(player.id)));
      roster.querySelectorAll('[data-player-id]').forEach(card => { card.hidden = !ids.has(card.dataset.playerId); });
      document.getElementById('roster-count').textContent = `${ids.size} / ${players.length} 選手を表示`;
      document.getElementById('roster-empty').hidden = ids.size !== 0;
    }
    query.addEventListener('input', filterRoster);
    position.addEventListener('change', filterRoster);
    document.querySelector('[data-reset-roster]')?.addEventListener('click', () => {
      query.value = ''; position.value = ''; filterRoster(); query.focus();
    });
    filterRoster();
  }

  const playerRoot = document.getElementById('player-detail');
  if (playerRoot) {
    const id = playerRoot.dataset.player || new URLSearchParams(location.search).get('id');
    const player = data.players.find(item => String(item.id) === id);
    const team = player && teamsById.get(String(player.team_id));
    if (!player || !team) {
      playerRoot.innerHTML = '<section class="empty-state"><h1>選手を選んでください</h1><p>チームページの選手カード、または上部の検索から選手を探せます。</p><a class="pill-link" href="all-teams.html">全30チームを見る →</a></section>';
      document.title = '選手を探す | NBA Teams & Players';
      return;
    }
    document.title = `${player.name} | NBA Teams & Players`;
    document.body.dataset.teamTheme = String(team.id);
    const height = heightCm(player.height);
    const weight = weightKg(player.weight);
    const draft = player.draft_year && player.draft_year !== 'Undrafted'
      ? `${esc(player.draft_year)}年${player.draft_round ? ` · ${esc(player.draft_round)}巡目` : ''}${player.draft_number ? ` ${esc(player.draft_number)}位` : ''}`
      : 'ドラフト外／公式未掲載';
    const fact = (label, value) => `<div class="fact"><dt>${label}</dt><dd>${value}</dd></div>`;
    playerRoot.innerHTML = `
      <nav class="breadcrumbs" aria-label="現在位置"><a href="index.html">マップ</a><span>/</span><a href="${team.page}">${esc(team.name)}</a><span>/</span><span>${esc(player.name)}</span></nav>
      <section class="player-hero">
        <figure class="player-portrait"><img src="${portrait(player.id, '1040x760')}" alt="${esc(player.name)}" onerror="this.onerror=null;this.src='${fallbackImage}'" width="1040" height="760" decoding="async" fetchpriority="high"></figure>
        <div class="player-about"><span class="team-tag">${esc(player.position || 'PLAYER')}${player.number ? ` · #${esc(player.number)}` : ''}</span>
          <h1>${esc(player.name)}</h1>${player.jp ? `<p class="player-note">${esc(player.jp)}</p>` : ''}
          <a class="player-team-link" href="${team.page}"><img src="${team.logo}" alt="">${esc(team.name)} →</a>
          <dl class="player-numbers"><div class="player-number"><dt>背番号</dt><dd>${esc(player.number || '—')}</dd></div><div class="player-number"><dt>身長</dt><dd>${height ? height + '<small> cm</small>' : '—'}</dd></div><div class="player-number"><dt>体重</dt><dd>${weight ? weight + '<small> kg</small>' : '—'}</dd></div></dl>
          <dl class="player-details">${fact('ポジション', esc(player.position || '公式未掲載'))}${fact('出身国', esc(player.country || '公式未掲載'))}${fact('出身校・所属', esc(player.college || '公式未掲載'))}${fact('ドラフト', draft)}</dl>
          <a class="pill-link" href="https://www.nba.com/player/${player.id}/${esc(player.slug)}" target="_blank" rel="noopener noreferrer">NBA公式プロフィール ↗</a>
          <p class="player-note">NBA.com掲載情報 · ${esc(data.updated_at)}取得。身長・体重は公式値から換算。</p>
        </div>
      </section>`;
  }
})();
