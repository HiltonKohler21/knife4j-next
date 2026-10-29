#!/usr/bin/env python3
"""Exercise the guard against drift and missing files without changing real sources."""

import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("parity", Path(__file__).with_name("verify-aggregation-parity.py"))
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


class AggregationParityTest(unittest.TestCase):
    def test_shared_source_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = "example/Shared.java"
            paths = [root / "knife4j" / module / "src/main/java" / source for module in parity.MODULES]
            for path in paths:
                path.parent.mkdir(parents=True)
                path.write_text("class Shared {}\n")
            self.assertEqual([], parity.verify(root, [source]))
            paths[1].write_text("class Shared { int changed; }\n")
            self.assertEqual(["Aggregation implementations differ: " + source], parity.verify(root, [source]))
            paths[1].unlink()
            self.assertIn("Missing shared source", parity.verify(root, [source])[0])


if __name__ == "__main__":
    unittest.main()
