#!/usr/bin/env python3
"""Check geographic button coverage and actual box separation at supported map widths."""
from pathlib import Path
from itertools import combinations
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
css = (ROOT / 'assets/css/style.css').read_text()
data = json.loads((ROOT / 'assets/data/nba.json').read_text())
positions = {
    name: dict(zip(('fitx', 'fity', 'zoomx', 'zoomy'), map(float, values)))
    for name, *values in re.findall(
        r'\.pin-([\w-]+) \{ --mobile-x:([\d.]+)%; --mobile-y:([\d.]+)%; --zoom-x:([\d.]+)%; --zoom-y:([\d.]+)%; \}', css
    )
}
assert set(positions) == {team['pin'] for team in data['teams']}
viewbox = list(map(float, ET.parse(ROOT / 'assets/img/usa-arena.svg').getroot().get('viewBox').split()))
assert viewbox == [0, 0, 7306, 4548]
ratio = viewbox[3] / viewbox[2]
desktop_size, desktop_relative = map(float, re.search(r'\.pin \.label \{[^}]*width:min\(([\d.]+)px,([\d.]+)cqw\);', css).groups())
minimum, relative, maximum = map(float, re.search(r'clamp\(([\d.]+)px,([\d.]+)cqw,([\d.]+)px\)', css).groups())
fit_cap = float(re.search(r'--fit-pin:min\(([\d.]+)cqw', css).group(1))
zoom_size = float(re.search(r'\[data-map-view=zoom\] \.pin \.label \{ width:([\d.]+)px;', css).group(1))

cases = [('fit', width, min(width*fit_cap/100, maximum, max(minimum, width*relative/100))) for width in range(160, 723, 5)]
cases += [('zoom', width, min(desktop_size, width*desktop_relative/100)) for width in range(160, 1201, 10)]
cases += [('zoom', 1380, zoom_size)]
for view, width, size in cases:
    height = width * ratio
    boxes = {name: (p[view+'x']*width/100, p[view+'y']*height/100) for name, p in positions.items()}
    for name, (x, y) in boxes.items():
        assert x-size/2 >= 0 and x+size/2 <= width, (view, width, name, 'horizontal clipping')
        assert y-size/2 >= 0 and y+size/2 <= height, (view, width, name, 'vertical clipping')
    for (name, (x, y)), (other, (ox, oy)) in combinations(boxes.items(), 2):
        assert abs(x-ox) >= size or abs(y-oy) >= size, (view, width, name, other, 'overlap')

print(f'PASS: all 30 map targets; {len(cases)} desktop/mobile/zoom layouts; no overlap or clipping.')
