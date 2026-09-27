import json
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

from agentscope import _matches, main, scan

FIXTURE = Path(__file__).parent / "example_repo"

class AgentScopeTests(unittest.TestCase):
    def test_glob_matches_nested_python(self):
        self.assertTrue(_matches("**/*.py", "src/api/service.py"))
        self.assertFalse(_matches("**/*.md", "src/api/service.py"))

    def test_maps_expected_instruction_order(self):
        result = scan(FIXTURE, "src/api/service.py")
        paths = [item["path"] for item in result["applicable"]]
        self.assertEqual(paths[0], ".github/instructions/python.instructions.md")
        self.assertLess(paths.index(".github/copilot-instructions.md"), paths.index("src/AGENTS.md"))
        self.assertLess(paths.index("src/AGENTS.md"), paths.index("AGENTS.md"))

    def test_ignores_nonmatching_markdown_rule(self):
        paths = [item["path"] for item in scan(FIXTURE, "src/api/service.py")["applicable"]]
        self.assertNotIn(".github/instructions/docs.instructions.md", paths)

    def test_cli_json_output(self):
        buf = StringIO()
        with redirect_stdout(buf):
            code = main(["src/api/service.py", "--root", str(FIXTURE), "--json"])
        self.assertEqual(code, 0)
        payload = json.loads(buf.getvalue())
        self.assertEqual(payload["target"], "src/api/service.py")
        self.assertEqual(len(payload["applicable"]), 4)

if __name__ == "__main__":
    unittest.main()
