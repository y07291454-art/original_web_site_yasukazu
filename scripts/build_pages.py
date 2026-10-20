#!/usr/bin/env python3
"""Generate the 30 static team pages from the checked-in NBA snapshot.

Run from any directory: python scripts/build_pages.py
The site itself requires only HTML, CSS and JavaScript, with no server or build tool.
"""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'assets/data/nba.json').read_text())
TEAMS = DATA['teams']
PLAYERS = DATA['players']
STATS = json.loads((ROOT / 'assets/data/player-stats.json').read_text())
E = lambda value: escape(str(value), quote=True)
DATE = DATA['updated_at'].replace('-', '/')
ASSET_VERSION = '20261020-explore-15'
# Display accents complement the checked-in team colors on dark surfaces.
TEAM_ACCENTS = {
    'BOS':'#9bddac','BKN':'#e9edf5','NYK':'#ffa15d','PHI':'#7fbdff','TOR':'#ff7b94',
    'CHI':'#ff7b8c','CLE':'#e8b876','DET':'#ff7a90','IND':'#ffd264','MIL':'#b7d6aa',
    'ATL':'#ff8585','CHA':'#77ddd7','MIA':'#ff8d9f','ORL':'#83ceff','WAS':'#9cc8ff',
    'DEN':'#ffd264','MIN':'#b1d789','OKC':'#76ceff','POR':'#ff8194','UTA':'#cbb0ff',
    'GSW':'#ffd264','LAC':'#9cc8ff','LAL':'#fdb927','PHX':'#ffaa66','SAC':'#d1b1ff',
    'DAL':'#99d3ff','HOU':'#ff858f','MEM':'#b1c6ff','NOP':'#e8c68d','SAS':'#e0e5ec',
}
DIVISIONS = [
    ('East', 'Atlantic'), ('East', 'Central'), ('East', 'Southeast'),
    ('West', 'Northwest'), ('West', 'Pacific'), ('West', 'Southwest'),
]
SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>'
MENU_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>'
BALL_ICON = '<svg class="brand-ball" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="16" cy="16" r="14"/><path d="M2 16h28M16 2v28M6 6c12 4 16 12 20 20M26 6C14 10 10 18 6 26"/></svg>'
LOCATION_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>'
ARENA_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><ellipse cx="12" cy="7" rx="10" ry="4"/><path d="M2 7v10c0 5 20 5 20 0V7M7 11v9M12 11v10M17 11v9"/></svg>'
GLOBE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5c4 2 10 2 14 0M5 17.5c4-2 10-2 14 0"/></svg>'
ZOOM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5M7 10.5h7M10.5 7v7"/></svg>'


def header(active=''):
    current = lambda name: ' aria-current="page"' if active == name else ''
    return f'''<a class="skip-link" href="#main">本文へスキップ</a>
  <header class="site-header"><div class="header-bar">
    <a class="logo" href="index.html" aria-label="NBA Teams & Players ホーム">{BALL_ICON}<span><strong>NBA</strong> Teams<span class="amp">&amp;</span>Players</span></a>
    <nav class="header-links" aria-label="メインナビゲーション"><a href="index.html"{current('map')}>マップ</a><a href="all-teams.html"{current('teams')}>全30チーム</a><a href="players.html"{current('players')}>選手を探す</a><a href="schedule.html"{current('schedule')}>試合日程</a></nav>
    <div class="icons"><button class="icon-button" type="button" data-open-search aria-label="チーム・選手を検索">{SEARCH_ICON}</button><button class="icon-button menu-button" type="button" data-menu-toggle aria-label="メニュー" aria-expanded="false" aria-controls="mobile-menu">{MENU_ICON}</button></div>
  </div><nav class="mobile-menu" id="mobile-menu" aria-label="サイトメニュー" hidden><a href="index.html">マップ</a><a href="all-teams.html">全30チーム</a><a href="players.html">選手を探す・ランキング</a><a href="compare.html">選手を比較<span class="menu-count" data-compare-count>0/2</span></a><a href="favorites.html">推しチーム・選手<span class="menu-count" data-favorite-count>0</span></a><a href="schedule.html">試合日程</a></nav></header>'''


def footer(compact=False, with_stats=False):
    credits = f'<span>NBA非公式ファンサイト</span><span>選手情報：<a href="https://www.nba.com/players" target="_blank" rel="noopener noreferrer">NBA.com</a> · {DATE}</span>' if compact else f'<span class="footer-brand">NBA Teams &amp; Players</span><span>選手情報：<a href="https://www.nba.com/players" target="_blank" rel="noopener noreferrer">NBA.com</a> · {DATE}取得<br>NBA・各チームの非公式ファンサイト</span>'
    stats_scripts = f'<script src="assets/js/player-stats-data.js?v={ASSET_VERSION}" defer></script><script src="assets/js/stats.js?v={ASSET_VERSION}" defer></script>' if with_stats else ''
    return f'''<footer class="site-footer">{credits}</footer>
  <dialog class="search-dialog" id="site-search" aria-labelledby="search-title"><div class="search-top"><h2 id="search-title">チーム・選手を探す</h2><button class="close-button" type="button" data-close-search aria-label="検索を閉じる">×</button></div><div class="search-field"><label for="site-search-input">チーム名・略称・選手名</label><input id="site-search-input" type="search" placeholder="例：レイカーズ / DAL / Curry" autocomplete="off"></div><p class="search-status" id="search-status" role="status" aria-live="polite">チーム名・略称・選手名で検索できます。</p><div class="search-results" id="search-results"></div></dialog>
  <script src="assets/js/nba-data.js" defer></script><script src="assets/js/filters.js" defer></script>{stats_scripts}<script src="assets/js/explore-core.js?v={ASSET_VERSION}" defer></script><script src="assets/js/app.js?v={ASSET_VERSION}" defer></script><script src="assets/js/features.js?v={ASSET_VERSION}" defer></script>'''


def document(title, body_class, content, *, active='', extra_css='', theme='', description=''):
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{E(title)} | NBA Teams &amp; Players</title>
  <meta name="description" content="{E(description or '地図からNBA全30チームと選手を探せるファンサイト。チーム情報・選手プロフィールを紹介します。')}">
  <meta name="theme-color" content="#08111f"><meta name="color-scheme" content="dark">
  <link rel="preload" as="image" href="assets/img/arena-night.webp" media="(min-width:761px)">
  <link rel="preload" as="image" href="assets/img/arena-night-mobile.webp" media="(max-width:760px)">
  {extra_css}<link rel="stylesheet" href="assets/css/complete.css?v={ASSET_VERSION}">
  <link rel="stylesheet" href="assets/css/team-themes.css?v={ASSET_VERSION}">
  <link rel="stylesheet" href="assets/css/immersive.css?v={ASSET_VERSION}">
  <link rel="stylesheet" href="assets/css/stats.css?v={ASSET_VERSION}">
  <link rel="stylesheet" href="assets/css/features.css?v={ASSET_VERSION}">
</head>
<body class="{body_class}"{f' data-team-theme="{theme}"' if theme else ''}>
  {header(active)}
  {content}
  {footer(compact=body_class == 'home-page', with_stats=body_class in ('player-page', 'explorer-page', 'compare-page', 'favorites-page'))}
</body>
</html>
'''


def write(name, content):
    (ROOT / name).write_text(content, encoding='utf-8')


def player_card(player):
    name = E(player['name'])
    number = f'#{E(player["number"])}' if player['number'] else ''
    latest = STATS['seasons'][0]
    record = latest['players'].get(str(player['id']))
    if record:
        value = lambda key: f'{record[key]:.1f}' if isinstance(record[key], (int, float)) else '—'
        values = ''.join(f'<div><dt><abbr title="{label}">{key}</abbr></dt><dd>{value(key)}</dd></div>' for key, label in [('PTS', '得点'), ('REB', 'リバウンド'), ('AST', 'アシスト')])
        stat_line = f'<dl class="card-stats">{values}</dl><p class="card-stats-season">{latest["id"]} · 1試合平均</p>'
    else:
        stat_line = f'<p class="card-stats-missing">{latest["id"]}：NBA公式記録なし</p>'
    return f'''<article class="card" data-player-id="{player['id']}"><a class="card-link" href="player.html?id={player['id']}" aria-label="{name}のプロフィール"><div class="thumb"><div class="jersey">{number}<small>{E(player['position'] or 'PLAYER')}</small></div><img src="https://cdn.nba.com/headshots/nba/latest/1040x760/{player['id']}.png" srcset="https://cdn.nba.com/headshots/nba/latest/260x190/{player['id']}.png 260w, https://cdn.nba.com/headshots/nba/latest/1040x760/{player['id']}.png 1040w" sizes="(max-width:760px) calc((100vw - 40px)/2), (max-width:1050px) 30vw, 285px" alt="{name}" width="1040" height="760" loading="lazy" decoding="async" onerror="this.onerror=null;this.removeAttribute('srcset');this.src='assets/img/player-placeholder.svg'"></div><div class="card-copy"><h3 class="name">{name}</h3>{f'<p class="pos">{E(player["jp"])}</p>' if player.get('jp') else ''}{stat_line}<span class="card-action">プロフィール <span aria-hidden="true">→</span></span></div></a></article>'''


def sorted_roster(team):
    return sorted((p for p in PLAYERS if p['team_id'] == team['id']), key=lambda p: (int(p['number']) if p['number'].isdigit() else 999, p['name']))


def team_page(team, index):
    roster = sorted_roster(team)
    conference = 'Eastern' if team['conference'] == 'East' else 'Western'
    fact = lambda k, v, icon: f'<div class="fact">{icon}<div><dt>{E(k)}</dt><dd>{E(v)}</dd></div></div>'
    before, after = TEAMS[(index - 1) % 30], TEAMS[(index + 1) % 30]
    cards = '\n          '.join(player_card(p) for p in roster)
    content = f'''<main id="main" class="page-wrap">
    <nav class="breadcrumbs" aria-label="現在位置"><a class="back-link" href="index.html">← マップへ戻る</a><a href="all-teams.html">全30チーム</a><span>/</span><span>{E(team['abbreviation'])}</span></nav>
    <section class="team-header" aria-labelledby="team-title"><div class="badge"><img src="{team['logo']}" alt="{E(team['name'])} ロゴ" width="160" height="160" fetchpriority="high"></div><div class="team-heading-copy"><span class="team-tag">NBA · {E(team['abbreviation'])}</span><h1 id="team-title">{E(team['name'])}</h1><p class="team-jp">{E(team['jp'])}</p><div class="team-chips"><span>{LOCATION_ICON}{E(team.get('home_city_ja', team['home_city']))}</span><span>{ARENA_ICON}{E(team['arena'])}</span></div></div></section>
    <div class="team-tabs" data-team-tabs role="tablist" aria-label="チームページの表示" hidden><button type="button" id="team-tab-info" role="tab" data-team-tab="info" aria-controls="team-info" aria-selected="false" tabindex="-1">チーム情報</button><button type="button" id="team-tab-players" role="tab" data-team-tab="players" aria-controls="team-players" aria-selected="true">選手</button></div>
    <section class="team-info-panel" id="team-info" role="tabpanel" aria-labelledby="team-tab-info" tabindex="0"><h2 class="panel-heading">チーム情報</h2><div class="team-info-strip"><dl class="facts">{fact('本拠地', team.get('home_city_ja', team['home_city']), LOCATION_ICON)}{fact('アリーナ', team['arena'], ARENA_ICON)}</dl><a class="official-link" href="{E(team['source_urls'][0])}" target="_blank" rel="noopener noreferrer">NBA公式へ ↗</a></div><dl class="team-context"><div class="fact"><dt>カンファレンス</dt><dd>{conference} Conference</dd></div><div class="fact"><dt>ディビジョン</dt><dd>{E(team['division'])}</dd></div><div class="fact"><dt>掲載選手</dt><dd>{len(roster)}名 · {DATE}取得</dd></div></dl></section>
      <section class="roster-section" id="team-players" role="tabpanel" aria-labelledby="team-tab-players" tabindex="0"><div class="roster-toolbar"><div class="roster-heading"><h2 id="roster-title">選手一覧</h2><span>{len(roster)} PLAYERS</span></div>
        <details class="roster-refine"><summary>{SEARCH_ICON}<span>絞り込み</span></summary><div class="roster-tools"><div class="filter-field grow"><label for="roster-filter">選手名・背番号</label><input type="search" id="roster-filter" placeholder="選手名・背番号で検索" autocomplete="off"></div><div class="filter-field"><label for="position-filter">ポジション</label><select id="position-filter"><option value="">全ポジション</option><option value="G">ガード（G）</option><option value="F">フォワード（F）</option><option value="C">センター（C）</option></select></div></div></details></div>
        <div class="roster-meta"><p class="roster-count" id="roster-count" role="status" aria-live="polite">{len(roster)} / {len(roster)} 選手を表示</p><p class="roster-date">NBA公式掲載 · {DATE}取得</p></div>
        <div class="players" id="team-roster" data-team="{team['id']}">
          {cards}
        </div><div class="empty-state" id="roster-empty" hidden><p>条件に合う選手が見つかりません。</p><button class="pill-link" type="button" data-reset-roster>絞り込みを解除</button></div>
      </section>
    <nav class="team-pagination" aria-label="ほかのチーム"><a href="{before['page']}"><small>← 前のチーム</small>{E(before['name'])}</a><a href="{after['page']}"><small>次のチーム →</small>{E(after['name'])}</a></nav>
  </main>'''
    return document(team['name'], 'team-page', content, active='teams', theme=str(team['id']), description=f'{team["jp"]}のチーム情報・本拠地・アリーナと、NBA公式サイト掲載の{len(roster)}選手を紹介。')


def home():
    # The SVG retains the original map coordinate frame and team logo assets.
    order = ['POR', 'GSW', 'SAC', 'LAL', 'LAC', 'PHX', 'UTA', 'DEN', 'OKC', 'DAL', 'SAS', 'HOU', 'NOP', 'MEM', 'MIN', 'MIL', 'CHI', 'IND', 'DET', 'CLE', 'WAS', 'ATL', 'CHA', 'ORL', 'MIA', 'PHI', 'BKN', 'NYK', 'BOS', 'TOR']
    by_abbr = {t['abbreviation']: t for t in TEAMS}
    pins = '\n          '.join(f'<div class="pin pin-{by_abbr[a]["pin"]}"><a class="label" href="{by_abbr[a]["page"]}" data-label="{E(by_abbr[a]["jp"])}" aria-label="{E(by_abbr[a]["jp"])}のチームページ"><img src="{by_abbr[a]["logo"]}" alt="{E(by_abbr[a]["name"])}" width="52" height="52"></a></div>' for a in order)
    content = f'''<main id="main">
    <section class="home-mappu" aria-label="マップからチームを選ぶ"><div class="map-controls" data-map-controls role="group" aria-label="地図の表示" hidden><span>マップ</span><div><button type="button" data-map-view="fit" aria-pressed="true">{GLOBE_ICON}全体</button><button type="button" data-map-view="zoom" aria-pressed="false">{ZOOM_ICON}拡大</button></div></div><div class="map-frame"><div class="map-scroll" tabindex="0" role="region" aria-label="NBAチームの地図"><div class="map"><img src="assets/img/usa-arena.svg" alt="アメリカ合衆国の地図。本拠地の位置は概略です" width="7306" height="4548">
          {pins}
    </div></div></div><div class="map-caption"><span>全30チームのロゴからページを開けます。</span><span class="map-mobile-help" id="map-mobile-help" role="status" aria-live="polite">ロゴをタップ。選びにくいときは「拡大」。</span></div></section>
  </main>'''
    return document('NBA全30チームを地図で探す', 'home-page', content, active='map', extra_css=f'<link rel="stylesheet" href="assets/css/style.css?v={ASSET_VERSION}">')


def directory():
    sections = []
    for conf, div in DIVISIONS:
        group = [t for t in TEAMS if t['conference'] == conf and t['division'] == div]
        cards = []
        for team in group:
            count = sum(p['team_id'] == team['id'] for p in PLAYERS)
            cards.append(f'<a class="team-card" href="{team["page"]}" data-team-id="{team["id"]}" data-team-theme="{team["id"]}"><span class="directory-logo"><img src="{team["logo"]}" alt="" width="76" height="76" loading="lazy"></span><span class="abbr">{team["abbreviation"]}</span><h3>{E(team["name"])}</h3><p class="team-jp">{E(team["jp"])}</p><div class="team-card-bottom"><span>{count}選手</span><span class="go">見る →</span></div></a>')
        sections.append(f'<section class="division-section" aria-labelledby="division-{div.lower()}"><h2 class="division-heading" id="division-{div.lower()}"><strong>{div}</strong>{"EASTERN" if conf == "East" else "WESTERN"} CONFERENCE</h2><div class="team-cards">{"".join(cards)}</div></section>')
    options = ''.join(f'<option value="{div}">{div}</option>' for _, div in DIVISIONS)
    content = f'''<main id="main" class="page-wrap"><section class="directory-intro"><div class="eyebrow">FIND YOUR TEAM</div><h1>NBA 全30チーム</h1><p>チーム名やカンファレンスから、気になるチームを探そう。</p></section>
    <div class="directory-tools"><div class="conference-filters" role="group" aria-label="カンファレンス"><button type="button" data-conference="" aria-pressed="true">すべて</button><button type="button" data-conference="East" aria-pressed="false">EAST</button><button type="button" data-conference="West" aria-pressed="false">WEST</button></div><div class="filter-field grow"><label for="team-filter">チームを探す</label><input type="search" id="team-filter" placeholder="チーム名・都市・略称で検索" autocomplete="off"></div><div class="filter-field"><label for="division-filter">ディビジョン</label><select id="division-filter"><option value="">すべて</option>{options}</select></div></div>
    <p class="directory-count" id="directory-count" role="status" aria-live="polite">30 / 30 チームを表示</p><div id="team-directory">{''.join(sections)}</div><div class="empty-state" id="directory-empty" hidden><p>条件に合うチームが見つかりません。</p><button class="pill-link" type="button" data-reset-directory>すべてのチームを表示</button></div>
  </main>'''
    return document('全30チーム一覧', 'directory-page', content, active='teams')


def player_page(player_id=''):
    return document('選手プロフィール', 'player-page', f'<main id="main" class="page-wrap"><div id="player-detail" data-player="{player_id}"><noscript><section class="empty-state"><h1>選手プロフィール</h1><p>選手の詳細を見るにはJavaScriptを有効にしてください。</p><a class="pill-link" href="https://www.nba.com/players">NBA公式の選手一覧へ</a></section></noscript></div></main>', active='teams')



def feature_page(title, body_class, content, active='players'):
    return document(title, body_class, f'<main id="main" class="page-wrap">{content}</main>', active=active)


def feature_pages():
    intro = lambda eyebrow, title, text: f'<section class="feature-intro"><span class="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></section>'
    options = ''.join(f'<option value="{key}">{label}</option>' for key, label in [('PTS','得点'),('REB','リバウンド'),('AST','アシスト'),('STL','スティール'),('BLK','ブロック'),('FG3A','3P試投数'),('FGA','FG試投数'),('FG_PCT','FG成功率'),('FG3_PCT','3P成功率'),('FT_PCT','FT成功率'),('MIN','出場時間')])
    explorer = intro('PLAYER EXPLORER', '気になる選手を、見つけよう。', '条件を選んで探す。成績を比べて、新しい推しへ。') + f'''<section class="feature-panel"><form id="explorer-form" class="explorer-filters" aria-label="選手の検索条件">
      <label class="wide">選手名・チーム名<input type="search" name="query" placeholder="例：Curry / カリー / レイカーズ" autocomplete="off"></label>
      <label>シーズン<select name="season" id="explore-season"></select></label><label>並び順（高い順）<select name="metric">{options}</select></label>
      <label>所属チーム<select name="team" id="explore-team"></select></label><label>ポジション<select name="position"><option value="">全ポジション</option><option value="G">ガード（G）</option><option value="F">フォワード（F）</option><option value="C">センター（C）</option></select></label>
      <label>最低出場試合数<input type="number" name="minGames" min="0" max="82" step="1" value="10" inputmode="numeric"></label>
      <label>平均得点の下限<input type="number" name="minPoints" min="0" max="100" step="0.1" value="0" inputmode="decimal"></label>
      <label>平均3P試投数の下限<input type="number" name="minThrees" min="0" max="30" step="0.1" value="0" inputmode="decimal"></label>
      <label>身長の下限（cm）<input type="number" name="minHeight" min="140" max="260" placeholder="指定なし" inputmode="numeric"></label>
      <label>身長の上限（cm）<input type="number" name="maxHeight" min="140" max="260" placeholder="指定なし" inputmode="numeric"></label>
      <label>記録のない選手<select name="includeMissing"><option value="">表示しない</option><option value="1">含める（最低出場0で有効）</option></select></label>
    </form><div class="feature-actions"><button class="feature-button" id="explorer-reset" type="button">条件をリセット</button><a class="feature-button" href="compare.html">選手を比較 →</a></div><p class="feature-note" id="explorer-scope"></p><p class="feature-note">所属は{DATE}取得の名簿。各シーズン当時の所属を示すものではありません。</p></section>
    <div class="explorer-toolbar"><h2>条件内のランキング</h2><p id="explorer-count" role="status" aria-live="polite"></p></div><div id="explorer-ranking" class="explorer-ranking"></div><div class="players" id="explorer-results"><p class="load-state">選手を読み込み中…</p></div><div class="feature-actions"><button class="feature-button" id="explorer-more" type="button" hidden>さらに24人表示</button></div>'''
    write('players.html', feature_page('選手検索・ランキング', 'explorer-page', explorer))
    pickers=''.join(f'<div class="compare-picker"><label for="compare-query-{slot}">選手{slot+1}<input type="search" id="compare-query-{slot}" placeholder="選手名で検索" autocomplete="off" aria-controls="compare-matches-{slot}"></label><div class="compare-matches" id="compare-matches-{slot}" aria-live="polite"></div><div class="compare-selected" id="compare-selected-{slot}"></div></div>' for slot in range(2))
    compare = intro('SIDE BY SIDE', '2人の違いを、見てみよう。', '同じシーズンの成績を横に並べて比較。') + f'''<section class="feature-panel"><div class="compare-pickers">{pickers}</div></section><section class="feature-panel"><div class="feature-heading"><h2>シーズン成績</h2><label for="compare-season">シーズン<select id="compare-season"></select></label></div><div id="compare-content" aria-live="polite"></div><div class="feature-actions"><button class="feature-button" type="button" id="copy-compare-link">比較リンクをコピー</button><a class="feature-button" href="players.html">条件から選手を探す →</a></div><details id="compare-share-details"><summary>比較ページのURL</summary><label class="sr-only" for="compare-share-url">比較ページのURL</label><input class="share-url" id="compare-share-url" readonly type="url"></details></section>'''
    write('compare.html', feature_page('選手を比較', 'compare-page', compare))
    favorites = intro('YOUR FAVORITES', '推しに、すぐ会える。', 'チームや選手の「推しに保存」で、自分だけの一覧に。') + '<p class="feature-note">このブラウザに保存されます。別の端末への同期はありません。ブラウザのデータを消すと保存内容も削除されます。</p><div class="feature-actions"><a class="feature-button" href="players.html">選手を探す →</a><a class="feature-button" href="all-teams.html">チームを探す →</a></div><div id="favorites-content"></div>'
    write('favorites.html', feature_page('推しチーム・選手', 'favorites-page', favorites))
    schedule = intro('NEXT TIP-OFF', '次の試合は、いつ？', '日本時間でチェックして、カレンダーに追加しよう。') + '<section class="feature-panel"><div class="schedule-controls"><label for="schedule-team">チーム<select id="schedule-team"><option>読み込み中…</option></select></label><label for="schedule-month">日本時間の月<select id="schedule-month"><option value="">すべての月</option></select></label></div><p class="feature-note" id="schedule-source"></p><p class="feature-note">レギュラーシーズンの対戦確定分を掲載。カップ戦の対戦未定枠は含みません。カレンダーの終了時刻は開始から3時間後の仮置きです。</p><p id="schedule-count" class="feature-note" role="status" aria-live="polite"></p><div class="game-list" id="schedule-results" aria-live="polite"><p class="load-state">日程を読み込み中…</p></div><div class="feature-actions"><button class="feature-button" id="schedule-more" type="button" hidden>さらに30試合表示</button><a class="feature-button" href="https://www.nba.com/schedule" target="_blank" rel="noopener noreferrer">NBA公式日程 ↗</a></div></section>'
    write('schedule.html', feature_page('日本時間の試合日程', 'schedule-page', schedule, active='schedule'))


def main():
    assert len(TEAMS) == 30 and len({t['id'] for t in TEAMS}) == 30
    assert len({p['id'] for p in PLAYERS}) == len(PLAYERS)
    themes = ['/* Generated by scripts/build_pages.py; display accents on dark surfaces. */']
    for team in TEAMS:
        color = team['color']
        rgb = ' '.join(str(int(color[i:i+2], 16)) for i in (1, 3, 5))
        themes.append(f'[data-team-theme="{team["id"]}"] {{ --primary:{color}; --primary-rgb:{rgb}; --accent:{TEAM_ACCENTS[team["abbreviation"]]}; }}')
    (ROOT / 'assets/css/team-themes.css').write_text('\n'.join(themes) + '\n')
    for index, team in enumerate(TEAMS):
        write(team['page'], team_page(team, index))
    write('index.html', home())
    write('all-teams.html', directory())
    write('player.html', player_page())
    feature_pages()
    # Preserve the original Lakers URL and the existing Kyrie link.
    lakers_index = next(i for i, t in enumerate(TEAMS) if t['abbreviation'] == 'LAL')
    write('teams.html', team_page(TEAMS[lakers_index], lakers_index))
    kyrie = next((p for p in PLAYERS if p['slug'] == 'kyrie-irving'), None)
    if kyrie:
        write('kyrie.html', player_page(str(kyrie['id'])))
    (ROOT / 'assets/js/nba-data.js').write_text('// Official NBA.com roster snapshot; see assets/data/nba.json.\nwindow.NBA_DATA=' + json.dumps(DATA, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';\n')
    (ROOT / 'assets/js/player-stats-data.js').write_text('// Official NBA Stats snapshot; see assets/data/player-stats.json.\nwindow.NBA_PLAYER_STATS=' + json.dumps(STATS, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';\n')
    print(f'Generated 30 team pages, map, directory and profiles for {len(PLAYERS)} players.')


if __name__ == '__main__':
    main()
