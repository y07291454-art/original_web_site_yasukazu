#!/usr/bin/env python3
"""Check real generated navigation, local assets, profile targets and roster coverage."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, parse_qs, unquote
import collections
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'assets/data/nba.json').read_text())
TEAMS = DATA['teams']
PLAYERS = DATA['players']
PLAYER_IDS = {str(p['id']) for p in PLAYERS}
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.stack, self.ids, self.cards, self.links = path, [], set(), [], []
        self.h1_count = self.doctypes = 0
        self.team_theme = ''

    def handle_decl(self, decl):
        if decl.lower() == 'doctype html':
            self.doctypes += 1

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'body':
            self.team_theme = attrs.get('data-team-theme', '')
        if tag not in VOID:
            self.stack.append(tag)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, (self.path.name, 'duplicate ID', attrs['id'])
            self.ids.add(attrs['id'])
        if tag == 'h1':
            self.h1_count += 1
        if 'data-player-id' in attrs:
            self.cards.append(attrs['data-player-id'])
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
        for key in ('href', 'src'):
            value = attrs.get(key)
            if not value or value.startswith(('http:', 'https:', 'data:', 'mailto:')):
                continue
            parsed = urlsplit(value)
            if parsed.path:
                target = (self.path.parent / unquote(parsed.path)).resolve()
                assert target.is_relative_to(ROOT), (self.path.name, 'outside site', value)
                assert target.exists(), (self.path.name, 'broken local asset/link', value)
            if parsed.path == 'player.html':
                assert parse_qs(parsed.query).get('id', [''])[0] in PLAYER_IDS, (self.path.name, 'unknown player', value)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        assert self.stack and self.stack.pop() == tag, (self.path.name, 'invalid nesting', tag)


def parse(path):
    page = Page(path)
    page.feed(path.read_text())
    assert not page.stack, (path.name, 'unclosed tags', page.stack)
    assert page.doctypes == 1, (path.name, 'doctype')
    return page


def main():
    assert len(TEAMS) == 30 and len({t['page'] for t in TEAMS}) == 30
    assert collections.Counter(t['conference'] for t in TEAMS) == {'East': 15, 'West': 15}
    assert set(collections.Counter(t['division'] for t in TEAMS).values()) == {5}
    assert len(PLAYER_IDS) == len(PLAYERS)
    pages = {path.name: parse(path) for path in ROOT.glob('*.html')}
    map_html = (ROOT / 'index.html').read_text()
    map_links = re.findall(r'<a class="label" href="([^"]+)"', map_html)
    assert len(map_links) == 30 and set(map_links) == {t['page'] for t in TEAMS}
    directory_html = (ROOT / 'all-teams.html').read_text()
    directory_ids = re.findall(r'data-team-id="(\d+)"', directory_html)
    assert len(directory_ids) == 30 and len(set(directory_ids)) == 30
    total = 0
    theme_css = (ROOT / 'assets/css/team-themes.css').read_text()
    for team in TEAMS:
        page = pages[team['page']]
        expected = {str(p['id']) for p in PLAYERS if p['team_id'] == team['id']}
        assert page.h1_count == 1 and set(page.cards) == expected
        assert len(page.cards) == len(expected) and expected
        assert page.team_theme == str(team['id']), (team['page'], 'wrong team theme')
        assert f'[data-team-theme="{team["id"]}"]' in theme_css
        for required in ('roster-filter', 'position-filter', 'roster-count', 'team-roster', 'roster-empty'):
            assert required in page.ids, (team['page'], 'missing roster control', required)
        assert 'index.html' in page.links and team['source_urls'][0] in page.links
        total += len(page.cards)
    assert total == len(PLAYERS)
    for css_name in ('style.css', 'complete.css', 'team-themes.css'):
        css = ROOT / 'assets/css' / css_name
        for match in re.findall(r'url\([\'\"]?([^\)\'\"]+)', css.read_text()):
            if not match.startswith(('data:', 'http:','https:')):
                assert (css.parent / match).resolve().exists(), (css_name, match)
    runtime = (ROOT / 'assets/js/nba-data.js').read_text()
    runtime_data = json.loads(runtime.split('window.NBA_DATA=', 1)[1].rsplit(';', 1)[0].replace('<\\/', '</'))
    assert runtime_data == DATA
    print(f'PASS: {len(pages)} HTML pages; 30 map links; 30 complete rosters; {total} unique players; all local links/assets; data bundle parity.')


if __name__ == '__main__':
    main()
