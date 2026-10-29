#!/usr/bin/env python3
"""Keep the explicitly shared Boot2/Jakarta aggregation implementations in sync."""

from pathlib import Path
import sys


MODULES = (
    "knife4j-aggregation-spring-boot-starter",
    "knife4j-aggregation-jakarta-spring-boot-starter",
)


def verify(root, sources):
    failures = []
    for source in sources:
        paths = [root / "knife4j" / module / "src/main/java" / source for module in MODULES]
        missing = [str(path.relative_to(root)) for path in paths if not path.is_file()]
        if missing:
            failures.append("Missing shared source: " + ", ".join(missing))
        elif paths[0].read_bytes() != paths[1].read_bytes():
            failures.append("Aggregation implementations differ: " + source)
    return failures


def main():
    root = Path(__file__).resolve().parents[1]
    sources = [
        line.strip()
        for line in (root / "tools/aggregation-shared-sources.txt").read_text().splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not sources or len(sources) != len(set(sources)):
        raise SystemExit("Shared source list must be nonempty and contain no duplicates")
    failures = verify(root, sources)
    if failures:
        print("\n".join(failures), file=sys.stderr)
        print("Update both implementations, or document and review an intentional split.", file=sys.stderr)
        return 1
    print(f"Aggregation shared sources OK ({len(sources)} pairs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
