"""Builds samples/README.md and samples/index.html from samples.json.

Add a sample: put its folder under samples/<type>/, add one entry to samples.json,
then run `python samples/build_gallery.py`.
"""
import html
import json
from pathlib import Path

root = Path(__file__).parent
data = json.loads((root / 'samples.json').read_text(encoding='utf-8'))
types = {t['id']: t for t in data['types']}
by_type = {t: [s for s in data['samples'] if s['type'] == t] for t in types}


def size(p):
    return f'{p.stat().st_size / 1e6:.1f} MB'


md = ['# Sample videos', '',
      'One folder per video type. Watch these before choosing what to make (`/video-studio` offers them first). '
      'Open [`index.html`](index.html) in a browser to play them all.', '',
      'Add a sample: put its folder under `samples/<type>/`, add an entry to `samples.json`, '
      'run `python samples/build_gallery.py`.', '']
page = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Video samples</title>',
    '<style>:root{--bg:#f6f4ef;--fg:#1b1b1f;--card:#fff;--mute:#6b6b73;--line:#ddd}',
    '@media(prefers-color-scheme:dark){:root{--bg:#141418;--fg:#f1f1f3;--card:#1e1e24;--mute:#9a9aa5;--line:#34343c}}',
    'body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}',
    'main{max-width:1180px;margin:0 auto;padding:24px 16px}h1{margin:0 0 4px}h2{margin:36px 0 2px}',
    'p.s{color:var(--mute);margin:0 0 14px}',
    '.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}',
    '.c{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}',
    'video{display:block;width:100%;aspect-ratio:9/16;background:#000;object-fit:contain}',
    '.t{padding:10px 12px}.t b{display:block}.t span{color:var(--mute);font-size:13px;display:block}',
    '.p{padding:14px 12px;color:var(--mute);font-size:13px}</style></head><body><main>',
    '<h1>Video samples</h1><p class="s">One section per video type. Press play on any card.</p>',
]

for tid, items in by_type.items():
    t = types[tid]
    md += [f"## {t['title']} (`{t['engine']}` engine)", '', t['about'], '']
    page += [f"<h2>{html.escape(t['title'])} <small>({t['engine']})</small></h2>",
             f"<p class=\"s\">{html.escape(t['about'])}</p><div class=\"g\">"]
    rows = []
    for s in items:
        if s.get('pending'):
            md += [f"**Pending:** {s['topic']} See [`editor/README.md`](editor/README.md).", '']
            page += [f"<div class=\"c\"><div class=\"p\"><b>{html.escape(s['title'])}</b><br>"
                     f"Pending. {html.escape(s['topic'])}</div></div>"]
            continue
        rel = f"{s['dir']}/{s['video']}"
        files = []
        if s.get('sheet'):
            files.append(f"[sheet]({s['dir']}/{s['sheet']})")
        if s.get('source'):
            files.append(f"[{s['source']}]({s['dir']}/{s['source']})")
        rows.append(f"| {s['title']} | {s['style']} | {s['topic']} | "
                    f"[{s['video']}]({rel}) ({size(root / rel)}) | {' · '.join(files)} |")
        page += [f"<div class=\"c\"><video controls preload=\"none\" poster=\"{s['dir']}/poster.jpg\" src=\"{rel}\"></video>"
                 f"<div class=\"t\"><b>{html.escape(s['title'])}</b><span>{html.escape(s['style'])}</span>"
                 f"<span>{html.escape(s['topic'])}</span></div></div>"]
    if rows:
        md += ['| Title | Style | Topic | Video | Files |', '|---|---|---|---|---|'] + rows + ['']
    notes = [s['note'] for s in items if s.get('note')]
    md += [f'_{n}_' for n in notes] + ([''] if notes else [])
    page += ['</div>']

page += ['</main></body></html>']
(root / 'README.md').write_text('\n'.join(md), encoding='utf-8')
(root / 'index.html').write_text('\n'.join(page), encoding='utf-8')
print('wrote README.md and index.html')
