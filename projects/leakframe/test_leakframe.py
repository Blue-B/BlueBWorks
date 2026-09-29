import tempfile
import unittest
from pathlib import Path

import leakframe


class LeakFrameTests(unittest.TestCase):
    def test_demo_detects_location_camera_time_and_xmp(self):
        result = leakframe.inspect_jpeg(leakframe.demo_jpeg())
        self.assertTrue(result.exif)
        self.assertTrue(result.gps)
        self.assertTrue(result.camera)
        self.assertTrue(result.captured_at)
        self.assertTrue(result.xmp)
        self.assertTrue(result.comment)
        self.assertGreater(result.removable_bytes, 0)

    def test_strip_removes_privacy_segments_and_preserves_scan_bytes(self):
        original = leakframe.demo_jpeg()
        cleaned, before = leakframe.strip_privacy_metadata(original)
        after = leakframe.inspect_jpeg(cleaned)
        self.assertTrue(before.labels)
        self.assertEqual(after.labels, [])
        self.assertLess(len(cleaned), len(original))
        self.assertEqual(cleaned[cleaned.index(b"\xff\xda"):], original[original.index(b"\xff\xda"):])

    def test_jpeg_without_private_segments_is_unchanged(self):
        data = b"\xff\xd8" + leakframe._segment(0xE0, b"JFIF\x00") + b"\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00abc\xff\xd9"
        cleaned, result = leakframe.strip_privacy_metadata(data)
        self.assertEqual(result.labels, [])
        self.assertEqual(cleaned, data)

    def test_invalid_input_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "JPEG"):
            leakframe.inspect_jpeg(b"not an image")

    def test_clean_file_writes_sibling_copy_without_touching_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "photo.jpg"
            source.write_bytes(leakframe.demo_jpeg())
            original = source.read_bytes()
            target, result, before, after = leakframe.clean_file(source)
            self.assertEqual(source.read_bytes(), original)
            self.assertIsNotNone(target)
            self.assertTrue(target.exists())
            self.assertLess(after, before)
            self.assertTrue(result.gps)
            self.assertEqual(leakframe.inspect_jpeg(target.read_bytes()).labels, [])

    def test_dry_run_does_not_create_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "photo.jpg"
            source.write_bytes(leakframe.demo_jpeg())
            target, result, before, after = leakframe.clean_file(source, dry_run=True)
            self.assertIsNone(target)
            self.assertFalse((Path(tmp) / "photo.clean.jpg").exists())
            self.assertGreater(before, after)
            self.assertTrue(result.gps)


if __name__ == "__main__":
    unittest.main()
