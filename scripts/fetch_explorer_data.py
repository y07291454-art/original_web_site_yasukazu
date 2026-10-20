#!/usr/bin/env python3
"""Refresh official NBA schedule and per-player true shot locations.

Raw API evidence is cached outside the public site; use --refresh to download
fresh source snapshots instead of reusing that dated cache. Shot requests are split by
calendar month because the NBA endpoint caps a single response at 102,400 rows.
Every season is checked against official unrounded field-goal totals before any
public files are replaced. Run manually; the public site is a dated snapshot.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import argparse
import calendar
import collections
import json
import math
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
SCHEDULE_URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json'
JST = timezone(timedelta(hours=9))
ROW_CAP = 102400


def shot_url(season, date_from='', date_to=''):
    params = {key: '' for key in ('AheadBehind', 'ClutchTime', 'ContextFilter', 'DateFrom', 'DateTo', 'EndPeriod', 'EndRange', 'GameID', 'GameSegment', 'Location', 'Outcome', 'PlayerPosition', 'PointDiff', 'Position', 'RangeType', 'RookieYear', 'SeasonSegment', 'StartPeriod', 'StartRange', 'VsConference', 'VsDivision')}
    params.update(ContextMeasure='FGA', LastNGames=0, LeagueID='00', Month=0,
                  OpponentTeamID=0, Period=0, PlayerID=0, Season=season,
                  SeasonType='Regular Season', TeamID=0, DateFrom=date_from, DateTo=date_to)
    return 'https://stats.nba.com/stats/shotchartdetail?' + urlencode(params)


def total_url(season):
    from fetch_player_stats import source_url
    return source_url(season).replace('PerMode=PerGame', 'PerMode=Totals')


def dump_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(path)


def request_json(url, path, refresh=False):
    if path.exists() and not refresh:
        return json.loads(path.read_text())
    last_error = None
    for attempt in range(3):
        try:
            request = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.nba.com/'})
            with urlopen(request, timeout=45) as response:
                payload = json.load(response)
            dump_json(path, payload)
            return payload
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(1 + attempt)
    raise RuntimeError(f'Unable to read {url}: {last_error}')


def monthly_queries(season):
    start_year = int(season[:4])
    for month in (10, 11, 12, 1, 2, 3, 4):
        year = start_year if month >= 10 else start_year + 1
        begin, end = f'{month:02d}/01/{year}', f'{month:02d}/{calendar.monthrange(year, month)[1]}/{year}'
        yield f'{year}-{month:02d}', begin, end, shot_url(season, begin, end)


def parse_schedule(payload, teams, timestamp):
    league = payload['leagueSchedule']
    assert str(league['leagueId']) == '00'
    games, ids, unassigned = [], set(), 0
    for date in league['gameDates']:
        for game in date['games']:
            game_id = str(game['gameId'])
            if not game_id.startswith('002'):
                continue  # Regular season only; excludes preseason and Cup final.
            home, away = int(game['homeTeam']['teamId']), int(game['awayTeam']['teamId'])
            if home not in teams or away not in teams:
                unassigned += 1
                continue
            assert game_id not in ids and home != away
            ids.add(game_id)
            start = game['gameDateTimeUTC']
            parsed = datetime.fromisoformat(start.replace('Z', '+00:00'))
            assert parsed.tzinfo and int(league['seasonYear'][:4]) <= parsed.year <= int(league['seasonYear'][:4]) + 1
            status = int(game['gameStatus'])
            assert status in (1, 2, 3)
            status_text = game.get('gameStatusText', '')
            games.append({'id': game_id, 'start_utc': start, 'home_team_id': home, 'away_team_id': away,
                          'status': status, 'status_text': status_text,
                          'home_score': game['homeTeam'].get('score') if status in (2, 3) else None,
                          'away_score': game['awayTeam'].get('score') if status in (2, 3) else None,
                          'time_tba': 'TBD' in status_text.upper(),
                          'postponed': game.get('postponedStatus', 'N') != 'N',
                          'arena': game.get('arenaName', ''), 'label': game.get('gameLabel', '')})
    games.sort(key=lambda game: (game['start_utc'], game['id']))
    coverage = collections.Counter(team for game in games for team in (game['home_team_id'], game['away_team_id']))
    assert len(coverage) == 30 and min(coverage.values()) >= 78, coverage
    return {'season': league['seasonYear'], 'season_type': 'Regular Season', 'updated_at': timestamp,
            'source_url': SCHEDULE_URL, 'is_live': False, 'unassigned_games': unassigned,
            'games': games}


def collect_season(season, player_ids, cache, timestamp, refresh=False):
    queries = list(monthly_queries(season))
    def read(query):
        month, begin, end, url = query
        return query, request_json(url, cache / f'shots-{season}-{month}.json', refresh)
    shots_by_player = collections.defaultdict(list)
    totals_by_player = collections.defaultdict(lambda: [0, 0, 0, 0])
    seen, source_queries, outside_half = set(), [], 0
    with ThreadPoolExecutor(max_workers=3) as pool:
        for (month, begin, end, url), payload in pool.map(read, queries):
            params = payload['parameters']
            assert params['Season'] == season and params['SeasonType'] == 'Regular Season'
            assert params['ContextMeasure'] == 'FGA' and params['PlayerID'] == 0 and params['TeamID'] == 0
            table = next(t for t in payload['resultSets'] if t['name'] == 'Shot_Chart_Detail')
            assert len(table['rowSet']) < ROW_CAP, (season, month, 'truncated response')
            source_queries.append({'month': month, 'url': url, 'attempts': len(table['rowSet'])})
            for values in table['rowSet']:
                row = dict(zip(table['headers'], values))
                assert row['GAME_DATE'][:6] == month.replace('-', ''), (month, row['GAME_DATE'])
                identity = (row['GAME_ID'], row['GAME_EVENT_ID'])
                assert identity not in seen, ('duplicate event', identity)
                seen.add(identity)
                assert row['SHOT_ATTEMPTED_FLAG'] == 1 and row['SHOT_MADE_FLAG'] in (0, 1)
                x, y = row['LOC_X'], row['LOC_Y']
                assert all(isinstance(n, (int, float)) and math.isfinite(n) for n in (x, y))
                assert -260 <= x <= 260 and -70 <= y <= 900, (x, y)
                assert abs(math.hypot(x, y) / 10 - row['SHOT_DISTANCE']) <= 1.01, ('coordinate/distance mismatch', x, y, row['SHOT_DISTANCE'])
                player_id = str(row['PLAYER_ID'])
                totals_by_player[player_id][0] += 1
                totals_by_player[player_id][1] += row['SHOT_MADE_FLAG']
                if row['SHOT_TYPE'] == '3PT Field Goal':
                    totals_by_player[player_id][2] += 1
                    totals_by_player[player_id][3] += row['SHOT_MADE_FLAG']
                if player_id in player_ids:
                    shot_value = 3 if row['SHOT_TYPE'] == '3PT Field Goal' else 2
                    assert row['SHOT_TYPE'] in ('2PT Field Goal', '3PT Field Goal')
                    shots_by_player[player_id].append([x, y, row['SHOT_MADE_FLAG'], shot_value])
                    outside_half += y > 417.5
            print(f'{season} {month}: {len(table["rowSet"])} shots', flush=True)

    # Official totals catch missing months, silently capped responses and missing players.
    totals = request_json(total_url(season), cache / f'totals-{season}.json', refresh)
    assert totals['parameters']['PerMode'] == 'Totals' and totals['parameters']['Season'] == season
    table = totals['resultSets'][0]
    official_rows = [dict(zip(table['headers'], row)) for row in table['rowSet']]
    mismatches = []
    for row in official_rows:
        actual = totals_by_player[str(row['PLAYER_ID'])]
        expected = [row['FGA'], row['FGM'], row['FG3A'], row['FG3M']]
        if actual != expected:
            mismatches.append((row['PLAYER_ID'], actual, expected))
    assert not mismatches, ('shot totals do not match official season totals', season, mismatches[:10])
    assert sum(row['FGA'] for row in official_rows) == len(seen)
    for row in official_rows:
        if str(row['PLAYER_ID']) in player_ids:
            shots_by_player[str(row['PLAYER_ID'])]  # Preserve genuine zero-attempt seasons as empty records.
    result = {}
    for player_id, shots in shots_by_player.items():
        path = f'assets/data/shots/{season}/{player_id}.json'
        result[player_id] = {'payload': {'player_id': int(player_id), 'season': season,
                             'season_type': 'Regular Season', 'updated_at': timestamp,
                             'source_url': shot_url(season), 'coordinate_unit': '0.1 foot',
                             'coordinate_origin': 'basket', 'shots': shots},
                             'entry': {'attempts': len(shots), 'made': sum(s[2] for s in shots), 'path': path}}
    summary = {'league_attempts': len(seen), 'roster_attempts': sum(len(v['payload']['shots']) for v in result.values()),
               'players_with_shots': sum(values['entry']['attempts'] > 0 for values in result.values()),
               'players_with_records': len(result), 'official_totals_verified': True,
               'beyond_half_court_attempts': outside_half, 'source_queries': source_queries,
               'totals_source_url': total_url(season)}
    print(f'{season}: verified {len(seen)} league attempts; {len(result)} roster players', flush=True)
    return result, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-directory', type=Path, default=Path(tempfile.gettempdir()) / 'nba-explorer-source-cache')
    parser.add_argument('--seasons', nargs='+', default=['2025-26', '2024-25', '2023-24'])
    parser.add_argument('--refresh', action='store_true', help='Redownload even when raw evidence is cached')
    args = parser.parse_args()
    args.cache_directory.mkdir(parents=True, exist_ok=True)
    roster = json.loads((ROOT / 'assets/data/nba.json').read_text())
    player_ids, team_ids = {str(p['id']) for p in roster['players']}, {t['id'] for t in roster['teams']}
    timestamp = datetime.now(JST).isoformat(timespec='seconds')
    schedule_cache = args.cache_directory / 'scheduleLeagueV2_1.json'
    raw_schedule = request_json(SCHEDULE_URL, schedule_cache, args.refresh)
    schedule_timestamp = datetime.fromtimestamp(schedule_cache.stat().st_mtime, JST).isoformat(timespec='seconds')
    schedule = parse_schedule(raw_schedule, team_ids, schedule_timestamp)
    index = {'updated_at': timestamp, 'seasons': args.seasons, 'coordinate_unit': '0.1 foot',
             'coordinate_origin': 'basket', 'players': {}, 'coverage': {}}
    pending = []
    for season in args.seasons:
        players, summary = collect_season(season, player_ids, args.cache_directory, timestamp, args.refresh)
        index['players'][season] = {player_id: values['entry'] for player_id, values in players.items()}
        index['coverage'][season] = summary
        pending.extend((ROOT / values['entry']['path'], values['payload']) for values in players.values())
    # Publish only after all requested seasons have passed complete source checks.
    for path, payload in pending:
        dump_json(path, payload)
    dump_json(ROOT / 'assets/data/shot-chart-index.json', index)
    dump_json(ROOT / 'assets/data/schedule.json', schedule)
    print(json.dumps({'games': len(schedule['games']), 'schedule_season': schedule['season'],
                      'shot_files': len(pending), 'coverage': {s: {k: v for k, v in c.items() if k != 'source_queries'} for s, c in index['coverage'].items()}}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
