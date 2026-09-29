from pathlib import Path
from jpegparse import segments

REMOVE = {225, 237, 254}

def inspect_jpeg(data: bytes):
    labels=[]; removable=0
    for marker,payload,raw in segments(data)[0]:
        if marker == 225:
            removable += len(raw)
            label = 'EXIF' if payload.startswith(b'Exif\0\0') else 'XMP' if payload.startswith(b'http://ns.adobe.com/xap/1.0/\0') else 'APP1 metadata'
            if label not in labels: labels.append(label)
        elif marker == 237:
            removable += len(raw); labels.append('IPTC/Photoshop')
        elif marker == 254:
            removable += len(raw); labels.append('JPEG comment')
    return {'labels': labels, 'removable_bytes': removable}

def strip_metadata(data: bytes):
    parts, scan_start = segments(data)
    report = inspect_jpeg(data)
    out = bytearray(bytes.fromhex('ffd8'))
    for marker,_,raw in parts:
        if marker not in REMOVE and marker != 216:
            out.extend(raw)
    out.extend(data[scan_start:])
    return bytes(out), report

def clean_file(path: Path, output: Path|None=None, dry_run=False):
    original = path.read_bytes(); cleaned, report = strip_metadata(original)
    target = output or path.with_name(path.stem + '.clean' + path.suffix.lower())
    if not dry_run: target.write_bytes(cleaned)
    return None if dry_run else target, report, len(original), len(cleaned)
