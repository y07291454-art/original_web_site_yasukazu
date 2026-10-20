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
svg = ET.parse(ROOT / 'assets/img/usa-arena.svg').getroot()
viewbox = list(map(float, svg.get('viewBox').split()))
assert viewbox == [0, 0, 7306, 4548]
assert svg.get('preserveAspectRatio') == 'none'
ratio = viewbox[3] / viewbox[2]
immersive_css = (ROOT / 'assets/css/immersive.css').read_text()
mobile_ratio = float(re.search(r'height:min\(100cqh,([\d.]+)cqw\)', immersive_css).group(1)) / 100
assert mobile_ratio > ratio
desktop_size, desktop_relative = map(float, re.search(r'\.pin \.label \{[^}]*width:min\(([\d.]+)px,([\d.]+)cqw\);', css).groups())
minimum, relative, maximum = map(float, re.search(r'clamp\(([\d.]+)px,([\d.]+)cqw,([\d.]+)px\)', css).groups())
fit_cap = float(re.search(r'--fit-pin:min\(([\d.]+)cqw', css).group(1))
zoom_size = float(re.search(r'\[data-map-view=zoom\] \.pin \.label \{ width:([\d.]+)px;', css).group(1))

cases = [('fit', width, width*height_ratio, min(width*fit_cap/100, maximum, max(minimum, width*relative/100))) for width in range(160, 753, 5) for height_ratio in (ratio, (ratio+mobile_ratio)/2, mobile_ratio)]
cases += [('zoom', width, width*ratio, min(desktop_size, width*desktop_relative/100)) for width in range(160, 1201, 10)]
cases += [('zoom', 1380, 1380*ratio, zoom_size)]
for viewport_width, viewport_height in [(320,260),(320,400),(320,568),(390,600),(393,650),(430,740),(650,300),(760,320)]:
    for safe_top, safe_bottom in [(0,0),(47,34)]:
        content_width = viewport_width-8
        content_height = viewport_height-58-max(8,safe_top)-safe_bottom-12-64
        assert content_height > 0
        width = min(content_width,content_height/ratio)
        height = min(content_height,content_width*mobile_ratio)
        assert width <= content_width and height <= content_height
        cases.append(('fit',width,height,min(width*fit_cap/100,maximum,max(minimum,width*relative/100))))
for view, width, height, size in cases:
    boxes = {name: (p[view+'x']*width/100, p[view+'y']*height/100) for name, p in positions.items()}
    for name, (x, y) in boxes.items():
        assert x-size/2 >= 0 and x+size/2 <= width, (view, width, name, 'horizontal clipping')
        assert y-size/2 >= 0 and y+size/2 <= height, (view, width, name, 'vertical clipping')
    for (name, (x, y)), (other, (ox, oy)) in combinations(boxes.items(), 2):
        assert abs(x-ox) >= size or abs(y-oy) >= size, (view, width, name, other, 'overlap')

print(f'PASS: all 30 map targets; {len(cases)} desktop/mobile/zoom layouts; no overlap or clipping.')
