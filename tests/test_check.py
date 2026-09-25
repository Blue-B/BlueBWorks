"""Synthetic test fixtures validate the lab infrastructure, not a shipped product."""
from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('lab_check', Path(__file__).resolve().parents[1] / 'automation/check.py')
check = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check)


class ProjectValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.project = self.root / 'projects' / 'fixture-tool'
        self.project.mkdir(parents=True)
        (self.project / 'README.md').write_text('Synthetic test fixture only.', encoding='utf-8')
        (self.project / 'app.py').write_text('def twice(value):\n    return value * 2\n', encoding='utf-8')
        (self.project / 'test_app.py').write_text('from app import twice\nassert twice(3) == 6\n', encoding='utf-8')
        self.data = {
            'slug': 'fixture-tool', 'title': 'Synthetic fixture', 'summary': 'Only a validator fixture',
            'created_at': '2026-09-26', 'problem': 'Fixture problem', 'audience': 'Unit tests',
            'why_now': 'Regression tests', 'difference': 'Testing metadata validation',
            'monetization_hypothesis': 'Not applicable to a synthetic test fixture',
            'limitations': ['Synthetic, not a real product'], 'source_files': ['app.py'],
            'test_files': ['test_app.py'], 'setup': [],
            'checks': [{'kind': 'test', 'command': [sys.executable, 'test_app.py'], 'timeout_seconds': 10}],
            'sources': [
                {'url': 'https://docs.python.org/3/', 'primary': True, 'checked_at': '2026-09-26'},
                {'url': 'https://docs.github.com/', 'primary': False, 'checked_at': '2026-09-26'}],
            'alternatives': [
                {'name': 'Fixture A', 'url': 'https://python.org/', 'difference': 'Fixture only'},
                {'name': 'Fixture B', 'url': 'https://github.com/', 'difference': 'Fixture only'}]
        }
        self.save()

    def save(self):
        (self.project / 'project.json').write_text(json.dumps(self.data), encoding='utf-8')

    def reject(self, field, value):
        self.data[field] = value
        self.save()
        with self.assertRaises(ValueError):
            check.validate_project(self.project)

    def test_valid_registration(self):
        self.assertEqual(check.validate_project(self.project)['slug'], 'fixture-tool')

    def test_missing_required_fields(self):
        for field in ('title', 'problem', 'audience', 'difference', 'why_now', 'monetization_hypothesis'):
            with self.subTest(field=field):
                original = self.data[field]
                self.reject(field, '')
                self.data[field] = original

    def test_slug_must_match_folder(self):
        self.reject('slug', 'other-name')

    def test_date_format_and_calendar(self):
        for value in ('2026-02-30', '20260926', 'YYYY-MM-DD', None):
            with self.subTest(value=value):
                self.reject('created_at', value)

    def test_documentation_is_not_source_code(self):
        self.reject('source_files', ['README.md'])

    def test_missing_source_rejected(self):
        self.reject('source_files', ['missing.py'])

    def test_empty_source_rejected(self):
        (self.project / 'app.py').write_text('', encoding='utf-8')
        with self.assertRaises(ValueError):
            check.validate_project(self.project)

    def test_source_is_not_its_own_test(self):
        self.reject('test_files', ['app.py'])

    def test_escape_paths_rejected(self):
        for value in ('../outside.py', '/etc/passwd', '..\\outside.py'):
            with self.subTest(value=value):
                self.reject('source_files', [value])

    def test_symlink_escape_rejected(self):
        outside = self.root / 'outside.py'
        outside.write_text('print(1)', encoding='utf-8')
        (self.project / 'escape.py').symlink_to(outside)
        self.reject('source_files', ['escape.py'])

    def test_sources_need_distinct_urls(self):
        self.reject('sources', [self.data['sources'][0], self.data['sources'][0]])

    def test_primary_source_required(self):
        for source in self.data['sources']:
            source['primary'] = False
        self.reject('sources', self.data['sources'])

    def test_primary_marker_must_be_boolean(self):
        self.data['sources'][0]['primary'] = 'true'
        self.reject('sources', self.data['sources'])

    def test_real_https_urls_required(self):
        for value in ('http://docs.python.org', 'https://demo.invalid/', 'https://localhost/', 'https://user:secret@docs.python.org/'):
            with self.subTest(value=value):
                self.data['sources'][0]['url'] = value
                self.reject('sources', self.data['sources'])

    def test_two_alternatives_required(self):
        self.reject('alternatives', self.data['alternatives'][:1])

    def test_limitations_required(self):
        self.reject('limitations', [])

    def test_shell_string_is_not_a_command_array(self):
        self.reject('checks', [{'kind': 'test', 'command': 'python3 test_app.py'}])

    def test_timeout_bounds(self):
        for timeout in (0, 301, True, 1.5):
            with self.subTest(timeout=timeout):
                self.reject('checks', [{'kind': 'test', 'command': [sys.executable, 'test_app.py'], 'timeout_seconds': timeout}])

    def test_build_alone_is_not_a_test(self):
        self.reject('checks', [{'kind': 'build', 'command': [sys.executable, 'test_app.py']}])

    def test_malformed_manifest_is_a_validation_error(self):
        (self.project / 'project.json').write_text('[', encoding='utf-8')
        with self.assertRaises(ValueError):
            check.validate_project(self.project)

    def test_unregistered_directory_rejected(self):
        (self.root / 'projects' / 'forgot-manifest').mkdir()
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            self.assertEqual(check.main(['--root', str(self.root)]), 1)

    def test_actual_check_executes(self):
        with redirect_stdout(io.StringIO()):
            check.run_project(self.project, self.data)

    def test_actual_failure_propagates(self):
        self.data['checks'][0]['command'] = [sys.executable, '-c', 'raise SystemExit(3)']
        with redirect_stdout(io.StringIO()), self.assertRaises(subprocess.CalledProcessError):
            check.run_project(self.project, self.data)

    def test_actual_timeout_propagates(self):
        self.data['checks'][0] = {'kind': 'test', 'command': [sys.executable, '-c', 'import time; time.sleep(5)'], 'timeout_seconds': 1}
        with redirect_stdout(io.StringIO()), self.assertRaises(subprocess.TimeoutExpired):
            check.run_project(self.project, self.data)

    def test_metadata_only_does_not_execute_project(self):
        with patch.object(check.subprocess, 'run') as run, redirect_stdout(io.StringIO()):
            self.assertEqual(check.main(['--root', str(self.root)]), 0)
            run.assert_not_called()

    def test_empty_lab_is_not_claimed_as_product_verification(self):
        empty = self.root / 'empty'
        (empty / 'projects').mkdir(parents=True)
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertEqual(check.main(['--root', str(empty), '--run']), 0)
        self.assertIn('not a verified product', output.getvalue())


if __name__ == '__main__':
    unittest.main()
