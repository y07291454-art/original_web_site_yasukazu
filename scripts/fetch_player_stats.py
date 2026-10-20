#!/usr/bin/env python3
"""Refresh official regular-season per-game stats for the checked-in roster.

Run manually: python scripts/fetch_player_stats.py
Snapshots are validated in full before replacing the site's data file.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import argparse
import json
import math

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ('GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'FG_PCT', 'FG3_PCT', 'FT_PCT')


def source_url(season):
    params = {key: '' for key in ('College', 'Conference', 'Country', 'DateFrom', 'DateTo', 'Division', 'DraftPick', 'DraftYear', 'GameScope', 'GameSegment', 'Height', 'Location', 'Outcome', 'PlayerExperience', 'PlayerPosition', 'SeasonSegment', 'ShotClockRange', 'StarterBench', 'VsConference', 'VsDivision', 'Weight')}
    params.update(LastNGames=0, LeagueID='00', MeasureType='Base', Month=0, OpponentTeamID=0, PaceAdjust='N', PerMode='PerGame', Period=0, PlusMinus='N', Rank='N', SeasonType='Regular Season', TeamID=0, PORound=0, Season=season)
    return 'https://stats.nba.com/stats/leaguedashplayerstats?' + urlencode(params)


def parse_season(payload, season, player_ids):
    params = payload['parameters']
    assert params['Season'] == season and params['SeasonType'] == 'Regular Season'
    assert params['PerMode'] == 'PerGame', 'Totals must not be displayed as per-game stats'
    table = payload['resultSets'][0]
    headers = table['headers']
    assert set(FIELDS) | {'PLAYER_ID'} <= set(headers)
    rows = [dict(zip(headers, row)) for row in table['rowSet']]
    assert len(rows) > 400 and len({r['PLAYER_ID'] for r in rows}) == len(rows)
    players = {}
    for row in rows:
        assert row['GP'] > 0 and int(row['GP']) == row['GP']
        for key in FIELDS:
            value = row[key]
            assert value is None or (isinstance(value, (int, float)) and math.isfinite(value) and value >= 0)
            if key.endswith('_PCT') and value is not None:
                assert value <= 1
        if str(row['PLAYER_ID']) in player_ids:
            players[str(row['PLAYER_ID'])] = {key: row[key] for key in FIELDS}
    return {'id': season, 'source_url': source_url(season), 'source_rows': len(rows), 'players': players}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seasons', nargs='+', default=['2025-26', '2024-25', '2023-24'])
    parser.add_argument('--from-directory', type=Path, help='Use previously downloaded official JSON responses')
    args = parser.parse_args()
    assert len(set(args.seasons)) == len(args.seasons)
    ids = {str(p['id']) for p in json.loads((ROOT / 'assets/data/nba.json').read_text())['players']}

    def read(season):
        if args.from_directory:
            payload = json.loads((args.from_directory / f'full-{season}.json').read_text())
        else:
            request = Request(source_url(season), headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.nba.com/'})
            with urlopen(request, timeout=25) as response:
                payload = json.load(response)
        return parse_season(payload, season, ids)

    with ThreadPoolExecutor(max_workers=3) as pool:
        seasons = list(pool.map(read, args.seasons))
    snapshot = {'updated_at': datetime.now(timezone(timedelta(hours=9))).date().isoformat(), 'season_type': 'Regular Season', 'per_mode': 'PerGame', 'seasons': seasons}
    target = ROOT / 'assets/data/player-stats.json'
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(target)
    for season in seasons:
        print(f"{season['id']}: {len(season['players'])} roster players matched from {season['source_rows']} official records")


if __name__ == '__main__':
    main()
