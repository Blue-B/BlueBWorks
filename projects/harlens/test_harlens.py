import unittest
from harlens import analyze_har, human_bytes, render

SAMPLE = {
    "log": {"entries": [
        {"request":{"method":"GET","url":"https://api.example.com/a"},
         "response":{"status":200,"bodySize":1500},"time":120},
        {"request":{"method":"POST","url":"https://api.example.com/b"},
         "response":{"status":500,"bodySize":200},"time":1800},
        {"request":{"method":"GET","url":"https://cdn.example.net/x.js"},
         "response":{"status":404,"content":{"size":300},"bodySize":-1},"time":80}
    ]}
}

class HarLensTests(unittest.TestCase):
    def test_summary(self):
        r = analyze_har(SAMPLE, slow_ms=1000)
        self.assertEqual(r["requests"], 3)
        self.assertEqual(r["domains"][0], ("api.example.com", 2))
        self.assertEqual(r["status_groups"], {"2xx":1, "5xx":1, "4xx":1})
        self.assertEqual(len(r["failed"]), 2)
        self.assertEqual(r["slow"][0]["status"], 500)
        self.assertEqual(r["total_bytes"], 2000)

    def test_empty(self):
        r = analyze_har({"log":{"entries":[]}})
        self.assertEqual(r["requests"], 0)
        self.assertIn("(none)", render(r))

    def test_bytes(self):
        self.assertEqual(human_bytes(1024), "1.0 KB")

if __name__ == "__main__":
    unittest.main()
