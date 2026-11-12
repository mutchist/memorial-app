"""Join the four tapes' English subtitle files into one, for the joined video on YouTube.

Each tape's times are shifted by the length of the tapes before it (exact lengths in
seconds, from ffprobe). Writes subtitles/testimony.sbv.

Usage:  python merge_sbv.py 1724.5 1761.2 1805.0 1421.3
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TIME = re.compile(r'^(\d+):(\d\d):(\d\d)\.(\d{3}),(\d+):(\d\d):(\d\d)\.(\d{3})$')


def secs(h, m, s, ms):
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def stamp(t):
    ms = round(t * 1000)
    return f'{ms // 3600000}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}.{ms % 1000:03}'


durations = [float(x) for x in sys.argv[1:]]
if len(durations) != 4:
    sys.exit('Give the four tape lengths in seconds')
offset, blocks = 0.0, []
for n, length in enumerate(durations, 1):
    text = (ROOT / 'subtitles' / f'captions ({n}).sbv').read_text(encoding='utf-8-sig')
    for block in re.split(r'\n\s*\n', text.replace('\r\n', '\n').strip()):
        lines = block.split('\n')
        m = TIME.match(lines[0].strip())
        if not m:
            sys.exit(f'Tape {n}: cannot read the time line "{lines[0]}"')
        g = m.groups()
        start, end = secs(*g[:4]) + offset, secs(*g[4:]) + offset
        blocks.append(f'{stamp(start)},{stamp(end)}\n' + '\n'.join(lines[1:]))
    offset += length
out = ROOT / 'subtitles' / 'testimony.sbv'
out.write_text('\n\n'.join(blocks) + '\n', encoding='utf-8')
print(f'wrote {out}: {len(blocks)} lines, ends at {stamp(offset)}')
