import json
import tempfile
import unittest
from pathlib import Path

from installlens import InputError, analyze, main

LOCK = {
    "lockfileVersion": 3,
    "packages": {
        "": {"dependencies": {"sharp": "^1.0.0", "left-pad": "^1.3.0"}},
        "node_modules/sharp": {"version": "1.0.0", "resolved": "https://registry.npmjs.org/sharp/-/sharp-1.0.0.tgz", "integrity": "sha512-demo", "hasInstallScript": True},
        "node_modules/left-pad": {"version": "1.3.0", "resolved": "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz", "integrity": "sha512-demo"},
        "node_modules/@demo/git-tool": {"version": "2.0.0", "resolved": "git+https://github.com/example/git-tool.git"},
        "node_modules/remote-tool": {"version": "3.0.0", "resolved": "https://downloads.example.test/remote-tool.tgz"},
        "node_modules/no-integrity": {"version": "4.0.0", "resolved": "https://registry.npmjs.org/no-integrity/-/no-integrity-4.0.0.tgz"}
    }
}

class InstallLensTests(unittest.TestCase):
    def test_flags_review_surface(self):
        result = analyze(LOCK, {})
        self.assertEqual(result["packages"], 5)
        self.assertEqual(len(result["unreviewed_install_scripts"]), 1)
        self.assertEqual(result["git_dependencies"][0]["name"], "@demo/git-tool")
        self.assertEqual(result["remote_url_dependencies"][0]["name"], "remote-tool")
        self.assertEqual(result["registry_missing_integrity"][0]["name"], "no-integrity")

    def test_pinned_allow_script_marks_exact_version_approved(self):
        result = analyze(LOCK, {"allowScripts": {"sharp@1.0.0": True}})
        self.assertEqual(result["unreviewed_install_scripts"], [])
        self.assertTrue(result["install_script_packages"][0]["script_approved"])

    def test_explicit_false_stays_unreviewed(self):
        result = analyze(LOCK, {"allowScripts": {"sharp": False}})
        self.assertEqual(len(result["unreviewed_install_scripts"]), 1)

    def test_requires_lockfile_packages_object(self):
        with self.assertRaises(InputError):
            analyze({"lockfileVersion": 1})

    def test_cli_strict_returns_two_for_findings(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "package-lock.json"
            path.write_text(json.dumps(LOCK), encoding="utf-8")
            self.assertEqual(main([str(path), "--strict"]), 2)

if __name__ == "__main__":
    unittest.main()
