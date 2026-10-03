"""One-time optimization of generated site image assets; never changes page source."""
from pathlib import Path
import sys
from PIL import Image, ImageOps

path = Path(sys.argv[1]).resolve()
if path.parent.name != "assets" or path.suffix.lower() not in {".jpg", ".png"}:
    raise ValueError("Only supported image assets may be optimized")
with Image.open(path) as original:
    image = ImageOps.exif_transpose(original)
    image.thumbnail((1600, 1000), Image.Resampling.LANCZOS)
    if path.suffix.lower() == ".jpg":
        image.convert("RGB").save(path, "JPEG", quality=83, optimize=True, progressive=True)
    else:
        image.save(path, "PNG", optimize=True)
