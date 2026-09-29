from __future__ import annotations

from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest

import transition_guard

class TransitionGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name: str, content: str) -> Path:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_duplicate_static_names_are_reported(self):
        self.write("a.css", ".a { view-transition-name: card-image; }\n")
        self.write("b.css", ".b { view-transition-name: card-image; }\n")
        result = transition_guard.scan([str(self.root)], self.root)
        self.assertEqual(len(result.duplicate_names["card-image"]), 2)

    def test_unique_name_is_not_reported_as_duplicate(self):
        path = self.write("a.css", ".a { view-transition-name: hero; }\n")
        result = transition_guard.scan([str(path)], self.root)
        self.assertEqual(result.named_declarations, 1)
        self.assertEqual(result.duplicate_names, {})

    def test_css_keywords_are_ignored(self):
        self.write("a.css", ".a { view-transition-name: none; }\n.b { view-transition-name: match-element; }\n.c { view-transition-name: unset; }\n")
        result = transition_guard.scan([str(self.root)], self.root)
        self.assertEqual(result.named_declarations, 0)

    def test_block_comments_do_not_create_findings(self):
        path = self.write("a.css", "/* .old { view-transition-name: ghost; } */\n.real { view-transition-name: live; }\n")
        result = transition_guard.scan([str(path)], self.root)
        self.assertEqual(result.named_declarations, 1)

    def test_react_view_and_transition_type_are_counted(self):
        path = self.write("App.jsx", "const ui = <ViewTransition><Card /></ViewTransition>;\naddTransitionType('next');\n")
        result = transition_guard.scan([str(path)], self.root)
        self.assertEqual(len(result.react_view_transitions), 1)
        self.assertEqual(len(result.transition_types["next"]), 1)

    def test_transition_class_is_inventory_not_duplicate_error(self):
        self.write("a.css", ".a { view-transition-name: a; view-transition-class: card; }\n.b { view-transition-name: b; view-transition-class: card; }\n")
        result = transition_guard.scan([str(self.root)], self.root)
        self.assertEqual(len(result.view_transition_classes["card"]), 2)
        self.assertEqual(result.duplicate_names, {})

    def test_json_and_fail_on_duplicate(self):
        self.write("a.css", ".a { view-transition-name: hero; }\n")
        self.write("b.css", ".b { view-transition-name: hero; }\n")
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            code = transition_guard.main([str(self.root), "--json", "--fail-on-duplicate"])
        self.assertEqual(code, 1)
        payload = json.loads(stdout.getvalue())
        self.assertIn("hero", payload["duplicate_names"])

    def test_unsupported_files_are_skipped(self):
        self.write("notes.md", "view-transition-name: repeated\n")
        result = transition_guard.scan([str(self.root)], self.root)
        self.assertEqual(result.files, 0)

if __name__ == "__main__":
    unittest.main()
