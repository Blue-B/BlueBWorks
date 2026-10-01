"""Check README coverage and real animated GIF containers; capture provenance needs review."""
from pathlib import Path
import argparse
import json
import struct

ROOT = Path(__file__).resolve().parents[1]


def gif_info(data):
    if data[:6] not in (b'GIF87a', b'GIF89a') or len(data) < 13:
        raise ValueError('not a GIF')
    width, height = struct.unpack_from('<HH', data, 6)
    i = 13 + (3 * 2 ** ((data[10] & 7) + 1) if data[10] & 128 else 0)
    frames = 0
    def blocks(pos):
        while True:
            size = data[pos]
            pos += 1
            if not size:
                return pos
            pos += size
            if pos > len(data):
                raise ValueError('truncated GIF block')
    while i < len(data):
        marker = data[i]
        i += 1
        if marker == 0x3b:
            return width, height, frames
        if marker == 0x21:
            i = blocks(i + 1)
        elif marker == 0x2c:
            packed = data[i + 8]
            i += 9 + (3 * 2 ** ((packed & 7) + 1) if packed & 128 else 0)
            i = blocks(i + 1)
            frames += 1
        else:
            raise ValueError('invalid GIF marker')
    raise ValueError('missing GIF trailer')


def check(root, allow_pending=False):
    root = Path(root)
    index = (root / 'README.md').read_text()
    project_index = (root / 'projects/README.md').read_text()
    pending_path = root / "automation/pending-demos.json"
    pending = json.loads(pending_path.read_text()) if pending_path.exists() else {}
    results = []
    for manifest in sorted((root / 'projects').glob('*/project.json')):
        project = manifest.parent
        slug = project.name
        readme = (project / 'README.md').read_text()
        if slug in pending and not (project / 'demo.gif').exists():
            if not allow_pending:
                raise ValueError(f'{slug}: actual browser demo still pending: {pending[slug]}')
            if f'(projects/{slug}/)' not in index or f'({slug}/)' not in project_index:
                raise ValueError(f'{slug}: pending project still needs both index entries')
            print(f'PENDING {slug}: {pending[slug]}')
            continue
        if f'(projects/{slug}/)' not in index or f'(projects/{slug}/demo.gif)' not in index:
            raise ValueError(f'{slug}: missing linked project/demo in root README')
        if f'({slug}/)' not in project_index:
            raise ValueError(f'{slug}: missing projects index entry')
        if '(demo.gif)' not in readme:
            raise ValueError(f'{slug}: project README must embed demo.gif')
        try:
            info = gif_info((project / 'demo.gif').read_bytes())
        except (IndexError, OSError, struct.error) as exc:
            raise ValueError(f'{slug}: missing/truncated demo GIF') from exc
        if min(info[:2]) < 1 or info[2] < 2:
            raise ValueError(f'{slug}: demo must contain at least two actual GIF frames')
        results.append((slug, info))
    if not results:
        raise ValueError('no projects found')
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument("--allow-pending", action="store_true", help="report explicitly recorded missing captures and check completed demos only")
    args = parser.parse_args()
    for slug, (width, height, frames) in check(args.root, args.allow_pending):
        print(f'{slug}: {width}x{height}, {frames} frames; README links present')
    print('Completed-demo structure passed; any PENDING item above remains incomplete. Review execution provenance and visual readability separately.')
