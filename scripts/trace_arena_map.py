#!/usr/bin/env python3
"""Trace the site's original USA map without changing its projection or frame.

Requires Pillow, NumPy, SciPy, and contourpy. The source's black linework is
thresholded at half resolution, thinned with Zhang-Suen's algorithm, and traced
into SVG paths. This retains the original map/pin alignment and contains no
raster data. Run from the repository root: python scripts/trace_arena_map.py
"""

from pathlib import Path

import contourpy
import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/img/amerika-tizu.jpg"
OUTPUT = ROOT / "assets/img/usa-arena.svg"


def thin(mask):
    """Return an eight-connected, one-pixel-wide skeleton."""
    mask = mask.copy()
    while True:
        changed = False
        for second in (False, True):
            p = np.pad(mask, 1)
            n = (
                p[:-2, 1:-1], p[:-2, 2:], p[1:-1, 2:], p[2:, 2:],
                p[2:, 1:-1], p[2:, :-2], p[1:-1, :-2], p[:-2, :-2],
            )
            count = sum(v.astype(np.uint8) for v in n)
            transitions = sum(
                ((~n[i]) & n[(i + 1) % 8]).astype(np.uint8)
                for i in range(8)
            )
            if second:
                a = ~(n[0] & n[2] & n[6])
                b = ~(n[0] & n[4] & n[6])
            else:
                a = ~(n[0] & n[2] & n[4])
                b = ~(n[2] & n[4] & n[6])
            remove = mask & (count >= 2) & (count <= 6) & (transitions == 1) & a & b
            if np.any(remove):
                mask[remove] = False
                changed = True
        if not changed:
            return mask


def simplify(points, epsilon=1.25):
    """Ramer-Douglas-Peucker simplification in half-resolution coordinates."""
    if len(points) < 3:
        return points
    keep = {0, len(points) - 1}
    pending = [(0, len(points) - 1)]
    while pending:
        start, end = pending.pop()
        if end - start < 2:
            continue
        a, b = points[start], points[end]
        v = b - a
        between = points[start + 1:end]
        length = np.linalg.norm(v)
        if length:
            distances = np.abs(v[0] * (between[:, 1] - a[1]) - v[1] * (between[:, 0] - a[0])) / length
        else:
            distances = np.linalg.norm(between - a, axis=1)
        offset = int(np.argmax(distances))
        if distances[offset] > epsilon:
            middle = start + 1 + offset
            keep.add(middle)
            pending.extend(((start, middle), (middle, end)))
    return points[sorted(keep)]


def skeleton_paths(mask):
    height, width = mask.shape
    pixels = {int(y * width + x) for y, x in np.argwhere(mask)}
    adjacent = {}
    for node in pixels:
        y, x = divmod(node, width)
        neighbors = []
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not (dy or dx):
                    continue
                ny, nx = y + dy, x + dx
                other = ny * width + nx
                if not (0 <= nx < width and 0 <= ny < height and other in pixels):
                    continue
                # Prefer an existing orthogonal step over a redundant diagonal.
                if dx and dy and (y * width + nx in pixels or ny * width + x in pixels):
                    continue
                neighbors.append(other)
        adjacent[node] = neighbors
    visited = set()
    paths = []

    def follow(start, other):
        points = [start]
        previous, current = start, other
        visited.add(tuple(sorted((start, other))))
        while True:
            points.append(current)
            if len(adjacent[current]) != 2:
                break
            next_node = next(v for v in adjacent[current] if v != previous)
            edge = tuple(sorted((current, next_node)))
            if edge in visited:
                break
            visited.add(edge)
            previous, current = current, next_node
        xy = np.array([(v % width, v // width) for v in points], dtype=float)
        if len(xy) > 1:
            paths.append(simplify(xy))

    # Junction-to-junction paths, followed by any isolated closed loops.
    for node, neighbors in adjacent.items():
        if len(neighbors) != 2:
            for other in neighbors:
                if tuple(sorted((node, other))) not in visited:
                    follow(node, other)
    for node, neighbors in adjacent.items():
        for other in neighbors:
            if tuple(sorted((node, other))) not in visited:
                follow(node, other)
    return paths


def path_data(points, scale, close=False):
    points = points * scale + scale / 2
    pairs = [f"{x:.1f},{y:.1f}" for x, y in points]
    return "M" + "L".join(pairs) + ("Z" if close else "")


def main():
    source = Image.open(SOURCE).convert("L")
    if source.size != (7306, 4548):
        raise ValueError("Source frame changed; verify the map pin coordinates first.")
    width, height = source.size
    scale = 2
    gray = np.array(source.resize((width // scale, height // scale), Image.Resampling.BOX))
    dark = gray < 100  # Excludes the original gray border/shadow.
    skeleton = thin(dark)
    stroke_radius = float(np.median(ndimage.distance_transform_edt(dark)[skeleton]))
    filled = ndimage.binary_fill_holes(dark)
    coast_distance = ndimage.distance_transform_edt(filled)
    land = coast_distance > stroke_radius
    contours = contourpy.contour_generator(z=land.astype(float)).lines(0.5)
    outlines = [simplify(contour, epsilon=0.9) for contour in contours if len(contour) > 10]
    # Only internal skeletons become state borders. The outer coast gets its
    # own lighter stroke, avoiding a second parallel coast line.
    internal = skeleton & (coast_distance > stroke_radius + 1.5)
    states = skeleton_paths(internal)
    coast_d = "".join(path_data(points, scale, True) for points in outlines)
    states_d = "".join(path_data(points, scale) for points in states)
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="7306" height="4548" viewBox="0 0 7306 4548">\n'
        '<!-- Traced from amerika-tizu.jpg; original coordinate frame retained. -->\n'
        f'<path d="{coast_d}" fill="#102a40" fill-rule="evenodd"/>\n'
        f'<path d="{states_d}" fill="none" stroke="#416786" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>\n'
        f'<path d="{coast_d}" fill="none" stroke="#658eb2" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>\n'
        '</svg>\n'
    )
    OUTPUT.write_text(svg)
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {OUTPUT.stat().st_size:,} bytes")
    print(f"Source frame: {width} x {height}; coast contours: {len(outlines)}; state paths: {len(states)}")
    print(f"Estimated original half-stroke width: {stroke_radius * scale:.2f} px")


if __name__ == "__main__":
    main()
