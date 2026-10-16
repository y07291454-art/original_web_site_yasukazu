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
E = lambda value: escape(str(value), quote=True)
DATE = DATA['updated_at'].replace('-', '/')
DIVISIONS = [
    ('East', 'Atlantic'), ('East', 'Central'), ('East', 'Southeast'),
    ('West', 'Northwest'), ('West', 'Pacific'), ('West', 'Southwest'),
]
SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>'
MENU_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>'


def header(active=''):
    current = lambda name: ' aria-current="page"' if active == name else ''
    return f'''<a class="skip-link" href="#main">本文へスキップ</a>
  <header class="site-header"><div class="header-bar">
    <a class="logo" href="index.html" aria-label="NBA Teams & Players ホーム">NBA Teams<span class="amp">&amp;</span>Players</a>
    <nav class="header-links" aria-label="メインナビゲーション"><a href="index.html"{current('map')}>マップ</a><a href="all-teams.html"{current('teams')}>全30チーム</a></nav>
    <div class="icons"><button class="icon-button" type="button" data-open-search aria-label="チーム・選手を検索">{SEARCH_ICON}</button><button class="icon-button menu-button" type="button" data-menu-toggle aria-label="メニュー" aria-expanded="false" aria-controls="mobile-menu">{MENU_ICON}</button></div>
  </div><nav class="mobile-menu" id="mobile-menu" aria-label="モバイルナビゲーション" hidden><a href="index.html">マップ</a><a href="all-teams.html">全30チーム</a></nav></header>'''


def footer():
    return f'''<footer class="site-footer"><span class="footer-brand">NBA Teams &amp; Players</span><span>選手情報：<a href="https://www.nba.com/players" target="_blank" rel="noopener noreferrer">NBA.com</a> · {DATE}取得<br>NBA・各チームの非公式ファンサイト</span></footer>
  <dialog class="search-dialog" id="site-search" aria-labelledby="search-title"><div class="search-top"><h2 id="search-title">チーム・選手を探す</h2><button class="close-button" type="button" data-close-search aria-label="検索を閉じる">×</button></div><div class="search-field"><label for="site-search-input">チーム名・略称・選手名</label><input id="site-search-input" type="search" placeholder="例：レイカーズ / DAL / Curry" autocomplete="off"></div><p class="search-status" id="search-status" role="status" aria-live="polite">チーム名・略称・選手名で検索できます。</p><div class="search-results" id="search-results"></div></dialog>
  <script src="assets/js/nba-data.js" defer></script><script src="assets/js/filters.js" defer></script><script src="assets/js/app.js" defer></script>'''


def document(title, body_class, content, *, active='', extra_css='', style='', description=''):
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{E(title)} | NBA Teams &amp; Players</title>
  <meta name="description" content="{E(description or '地図からNBA全30チームと選手を探せるファンサイト。チーム情報・選手プロフィールを紹介します。')}">
  <meta name="theme-color" content="#192d5f">
  {extra_css}<link rel="stylesheet" href="assets/css/complete.css">
</head>
<body class="{body_class}"{f' style="{style}"' if style else ''}>
  {header(active)}
  {content}
  {footer()}
</body>
</html>
'''


def write(name, content):
    (ROOT / name).write_text(content, encoding='utf-8')


def player_card(player):
    name = E(player['name'])
    number = f'#{E(player["number"])}' if player['number'] else ''
    return f'''<article class="card" data-player-id="{player['id']}"><a class="card-link" href="player.html?id={player['id']}" aria-label="{name}のプロフィール"><div class="thumb"><span class="jersey">{number}</span><img src="https://cdn.nba.com/headshots/nba/latest/260x190/{player['id']}.png" alt="{name}" width="260" height="190" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='assets/img/player-placeholder.svg'"></div><div class="card-copy"><h3 class="name">{name}</h3><p class="pos">{E(player['jp']) + ' · ' if player.get('jp') else ''}{E(player['position'] or 'ポジション未掲載')}</p></div></a></article>'''


def sorted_roster(team):
    return sorted((p for p in PLAYERS if p['team_id'] == team['id']), key=lambda p: (int(p['number']) if p['number'].isdigit() else 999, p['name']))


def team_page(team, index):
    roster = sorted_roster(team)
    conference = 'Eastern' if team['conference'] == 'East' else 'Western'
    fact = lambda k, v: f'<div class="fact"><dt>{E(k)}</dt><dd>{E(v)}</dd></div>'
    before, after = TEAMS[(index - 1) % 30], TEAMS[(index + 1) % 30]
    cards = '\n          '.join(player_card(p) for p in roster)
    content = f'''<main id="main" class="page-wrap">
    <nav class="breadcrumbs" aria-label="現在位置"><a href="index.html">マップ</a><span>/</span><a href="all-teams.html">全30チーム</a><span>/</span><span>{E(team['abbreviation'])}</span></nav>
    <div class="team-header"><div class="badge"><img src="{team['logo']}" alt="{E(team['name'])} ロゴ" width="92" height="92"></div><div><span class="team-tag">{E(team['abbreviation'])}</span><h1>{E(team['name'])}</h1><p class="team-jp">{E(team['jp'])}</p><div class="meta">{conference} Conference / {team['division']} Division</div></div></div>
    <div class="main-grid"><aside class="info" aria-labelledby="team-info-title"><h2 id="team-info-title">チーム情報</h2><dl class="facts">{fact('チーム名', team['jp'])}{fact('本拠地', team.get('home_city_ja', team['home_city']))}{fact('ホームアリーナ', team['arena'])}{fact('カンファレンス', conference)}{fact('ディビジョン', team['division'])}</dl><a class="official-link" href="{E(team['source_urls'][0])}" target="_blank" rel="noopener noreferrer">NBA公式チームページ ↗</a></aside>
      <section aria-labelledby="roster-title"><div class="roster-heading"><h2 id="roster-title">ロスター</h2><span>{len(roster)} PLAYERS</span></div><p class="roster-date">NBA公式サイト掲載選手 · {DATE}取得</p>
        <div class="roster-tools"><div class="filter-field grow"><label for="roster-filter">選手を探す</label><input type="search" id="roster-filter" placeholder="選手名・背番号で検索" autocomplete="off"></div><div class="filter-field"><label for="position-filter">ポジション</label><select id="position-filter"><option value="">すべて</option><option value="G">ガード（G）</option><option value="F">フォワード（F）</option><option value="C">センター（C）</option></select></div></div>
        <p class="roster-count" id="roster-count" role="status" aria-live="polite">{len(roster)} / {len(roster)} 選手を表示</p>
        <div class="players" id="team-roster" data-team="{team['id']}">
          {cards}
        </div><div class="empty-state" id="roster-empty" hidden><p>条件に合う選手が見つかりません。</p><button class="pill-link" type="button" data-reset-roster>絞り込みを解除</button></div>
      </section></div>
    <nav class="team-pagination" aria-label="ほかのチーム"><a href="{before['page']}"><small>← 前のチーム</small>{E(before['name'])}</a><a href="{after['page']}"><small>次のチーム →</small>{E(after['name'])}</a></nav>
  </main>'''
    return document(team['name'], 'team-page', content, active='teams', style=f'--primary:{team["color"]}', description=f'{team["jp"]}のチーム情報・本拠地・アリーナと、NBA公式サイト掲載の{len(roster)}選手を紹介。')


def home():
    # Keep the original map image, framing, pin positions and logo assets.
    order = ['POR', 'GSW', 'SAC', 'LAL', 'LAC', 'PHX', 'UTA', 'DEN', 'OKC', 'DAL', 'SAS', 'HOU', 'NOP', 'MEM', 'MIN', 'MIL', 'CHI', 'IND', 'DET', 'CLE', 'WAS', 'ATL', 'CHA', 'ORL', 'MIA', 'PHI', 'BKN', 'NYK', 'BOS', 'TOR']
    by_abbr = {t['abbreviation']: t for t in TEAMS}
    pins = '\n          '.join(f'<div class="pin pin-{by_abbr[a]["pin"]}"><a class="label" href="{by_abbr[a]["page"]}" data-label="{E(by_abbr[a]["jp"])}" aria-label="{E(by_abbr[a]["jp"])}のチームページ"><img src="{by_abbr[a]["logo"]}" alt="{E(by_abbr[a]["name"])}" width="52" height="52"></a></div>' for a in order)
    content = f'''<main id="main">
    <section class="home-intro page-wrap"><div><div class="eyebrow">NBA · 30 TEAMS</div><h1>地図から、好きなチームへ。</h1><p>ロゴを選んで、チーム情報と選手をチェック。</p></div><a class="text-link" href="all-teams.html">全30チームを一覧で見る <span aria-hidden="true">→</span></a></section>
    <section class="home-mappu" aria-label="マップからチームを選ぶ"><div class="map-frame"><div class="map-scroll" tabindex="0" role="region" aria-label="NBAチームの地図。スマートフォンでは左右にスクロールできます"><div class="map"><img src="assets/img/amerika-tizu.jpg" alt="アメリカ合衆国の地図。本拠地の位置は概略です" width="7306" height="4548">
          {pins}
    </div></div></div><div class="map-caption"><span>全30チームのロゴからページを開けます。</span><span class="map-hint">← 左右にスクロール →</span></div></section>
    <div class="home-conferences page-wrap"><a class="conference-card" href="all-teams.html?conference=West"><span class="conference-mark">W</span><div><strong>Western Conference</strong><small>ウェスタン · 15チーム</small></div><span class="arrow" aria-hidden="true">→</span></a><a class="conference-card" href="all-teams.html?conference=East"><span class="conference-mark">E</span><div><strong>Eastern Conference</strong><small>イースタン · 15チーム</small></div><span class="arrow" aria-hidden="true">→</span></a></div>
  </main>'''
    return document('NBA全30チームを地図で探す', 'home-page', content, active='map', extra_css='<link rel="stylesheet" href="assets/css/style.css">')


def directory():
    sections = []
    for conf, div in DIVISIONS:
        group = [t for t in TEAMS if t['conference'] == conf and t['division'] == div]
        cards = []
        for team in group:
            count = sum(p['team_id'] == team['id'] for p in PLAYERS)
            cards.append(f'<a class="team-card" href="{team["page"]}" data-team-id="{team["id"]}" style="--primary:{team["color"]}"><img src="{team["logo"]}" alt="" width="67" height="67" loading="lazy"><span class="abbr">{team["abbreviation"]}</span><h3>{E(team["name"])}</h3><p class="team-jp">{E(team["jp"])}</p><div class="team-card-bottom"><span>{count}選手</span><span class="go">見る →</span></div></a>')
        sections.append(f'<section class="division-section" aria-labelledby="division-{div.lower()}"><h2 class="division-heading" id="division-{div.lower()}"><strong>{div}</strong>{"EASTERN" if conf == "East" else "WESTERN"} CONFERENCE</h2><div class="team-cards">{"".join(cards)}</div></section>')
    options = ''.join(f'<option value="{div}">{div}</option>' for _, div in DIVISIONS)
    content = f'''<main id="main" class="page-wrap"><section class="directory-intro"><div class="eyebrow">FIND YOUR TEAM</div><h1>NBA 全30チーム</h1><p>チーム名やカンファレンスから、気になるチームを探そう。</p></section>
    <div class="directory-tools"><div class="conference-filters" role="group" aria-label="カンファレンス"><button type="button" data-conference="" aria-pressed="true">すべて</button><button type="button" data-conference="East" aria-pressed="false">EAST</button><button type="button" data-conference="West" aria-pressed="false">WEST</button></div><div class="filter-field grow"><label for="team-filter">チームを探す</label><input type="search" id="team-filter" placeholder="チーム名・都市・略称で検索" autocomplete="off"></div><div class="filter-field"><label for="division-filter">ディビジョン</label><select id="division-filter"><option value="">すべて</option>{options}</select></div></div>
    <p class="directory-count" id="directory-count" role="status" aria-live="polite">30 / 30 チームを表示</p><div id="team-directory">{''.join(sections)}</div><div class="empty-state" id="directory-empty" hidden><p>条件に合うチームが見つかりません。</p><button class="pill-link" type="button" data-reset-directory>すべてのチームを表示</button></div>
  </main>'''
    return document('全30チーム一覧', 'directory-page', content, active='teams')


def player_page(player_id=''):
    return document('選手プロフィール', 'player-page', f'<main id="main" class="page-wrap"><div id="player-detail" data-player="{player_id}"><noscript><section class="empty-state"><h1>選手プロフィール</h1><p>選手の詳細を見るにはJavaScriptを有効にしてください。</p><a class="pill-link" href="https://www.nba.com/players">NBA公式の選手一覧へ</a></section></noscript></div></main>', active='teams')


def main():
    assert len(TEAMS) == 30 and len({t['id'] for t in TEAMS}) == 30
    assert len({p['id'] for p in PLAYERS}) == len(PLAYERS)
    for index, team in enumerate(TEAMS):
        write(team['page'], team_page(team, index))
    write('index.html', home())
    write('all-teams.html', directory())
    write('player.html', player_page())
    # Preserve the original Lakers URL and the existing Kyrie link.
    lakers_index = next(i for i, t in enumerate(TEAMS) if t['abbreviation'] == 'LAL')
    write('teams.html', team_page(TEAMS[lakers_index], lakers_index))
    kyrie = next((p for p in PLAYERS if p['slug'] == 'kyrie-irving'), None)
    if kyrie:
        write('kyrie.html', player_page(str(kyrie['id'])))
    (ROOT / 'assets/js/nba-data.js').write_text('// Official NBA.com roster snapshot; see assets/data/nba.json.\nwindow.NBA_DATA=' + json.dumps(DATA, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';\n')
    print(f'Generated 30 team pages, map, directory and profiles for {len(PLAYERS)} players.')


if __name__ == '__main__':
    main()
