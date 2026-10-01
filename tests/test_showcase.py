import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('showcase', Path(__file__).resolve().parents[1] / 'automation/check_showcase.py')
showcase = importlib.util.module_from_spec(spec)
spec.loader.exec_module(showcase)

# Valid 1x1 GIF frames; these are structural-test fixtures, not product demos.
HEADER = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff'
FRAME = b'\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00'

class ShowcaseTests(unittest.TestCase):
    def test_frames_are_parsed_not_counted_as_bytes(self):
        self.assertEqual(showcase.gif_info(HEADER + FRAME * 2 + b'\x3b'), (1, 1, 2))

    def test_non_gif_rejected(self):
        with self.assertRaises(ValueError):
            showcase.gif_info(b'<svg>not a capture</svg>')

    def test_truncated_rejected(self):
        with self.assertRaises(ValueError):
            showcase.gif_info(HEADER + FRAME)

    def fixture(self, root, frames=2):
        project = root / 'projects/tool'
        project.mkdir(parents=True)
        (project / 'project.json').write_text('{}')
        (project / 'README.md').write_text('![demo](demo.gif)')
        (project / 'demo.gif').write_bytes(HEADER + FRAME * frames + b'\x3b')
        (root / 'README.md').write_text('[tool](projects/tool/) ![demo](projects/tool/demo.gif)')
        (root / 'projects/README.md').write_text('[tool](tool/)')

    def test_linked_animation_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            self.assertEqual(len(showcase.check(root)), 1)

    def test_static_image_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root, 1)
            with self.assertRaises(ValueError):
                showcase.check(root)

    def test_missing_index_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            (root / 'README.md').write_text('No tool here')
            with self.assertRaises(ValueError):
                showcase.check(root)

    def test_missing_project_embed_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            (root / 'projects/tool/README.md').write_text('No demo')
            with self.assertRaises(ValueError):
                showcase.check(root)

    def test_missing_binary_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            (root / 'projects/tool/demo.gif').unlink()
            with self.assertRaises(ValueError):
                showcase.check(root)

    def test_pending_is_failure_by_default_and_explicit_skip_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            project = root / 'projects/tool'
            (project / 'demo.gif').unlink()
            (root / 'automation').mkdir()
            (root / 'automation/pending-demos.json').write_text('{"tool":"browser blocked"}')
            with self.assertRaisesRegex(ValueError, 'pending'):
                showcase.check(root)
            # A second completed demo prevents an all-pending set from succeeding.
            self.fixture(root / 'another')
            import shutil
            shutil.copytree(root / 'another/projects/tool', root / 'projects/complete')
            (root / 'README.md').write_text('[tool](projects/tool/) [complete](projects/complete/) ![demo](projects/complete/demo.gif)')
            (root / 'projects/README.md').write_text('[tool](tool/) [complete](complete/)')
            result = showcase.check(root, allow_pending=True)
            self.assertEqual([slug for slug, _ in result], ['complete'])
