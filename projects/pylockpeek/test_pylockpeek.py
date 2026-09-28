import tempfile,unittest
from pathlib import Path
import pylockpeek

GOOD='''lock-version="1.0"
created-by="demo"
[[packages]]
name="pure"
version="1"
wheels=[{name="pure.whl"}]
[[packages]]
name="native"
version="2"
sdist={name="native.tar.gz"}
'''

class Tests(unittest.TestCase):
    def run_lock(self,text=GOOD):
        td=tempfile.TemporaryDirectory(); self.addCleanup(td.cleanup)
        p=Path(td.name)/"pylock.toml"; p.write_text(text,encoding="utf-8"); return pylockpeek.inspect(p)
    def test_counts_source_only(self):
        r=self.run_lock(); self.assertEqual(len(r["packages"]),2); self.assertEqual(r["source_only"],1)
    def test_artifacts(self):
        r=self.run_lock(); self.assertEqual(r["packages"][0]["artifacts"],["wheel:1"]); self.assertEqual(r["packages"][1]["artifacts"],["sdist"])
    def test_filter_cli(self):
        td=tempfile.TemporaryDirectory(); self.addCleanup(td.cleanup); p=Path(td.name)/"pylock.toml"; p.write_text(GOOD,encoding="utf-8"); self.assertEqual(pylockpeek.main([str(p),"--source-only","--json"]),0)
    def test_bad_version(self):
        with self.assertRaises(ValueError): self.run_lock('lock-version="2.0"\ncreated-by="x"\npackages=[]\n')
    def test_missing_name(self):
        with self.assertRaises(ValueError): self.run_lock('lock-version="1.0"\ncreated-by="x"\n[[packages]]\nversion="1"\n')
if __name__=="__main__": unittest.main()
