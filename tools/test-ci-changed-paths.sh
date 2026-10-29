#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
script="$repo_root/tools/ci-changed-paths.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0
export GIT_AUTHOR_NAME=ci-test GIT_AUTHOR_EMAIL=ci-test@example.invalid
export GIT_COMMITTER_NAME=ci-test GIT_COMMITTER_EMAIL=ci-test@example.invalid

git init -q -b master "$test_root/origin"
cd "$test_root/origin"
echo initial > initial
git add initial
git commit -qm initial
initial="$(git rev-parse HEAD)"
git switch -qc feature
mkdir -p front/ui-react/src
echo feature > front/ui-react/src/feature.test.ts
git add .
git commit -qm feature
head="$(git rev-parse HEAD)"
git switch -q master
mkdir docs
echo base-only > docs/base-only.md
git add .
git commit -qm base-only
base="$(git rev-parse HEAD)"
# Reproduce the old endpoint comparison including an unrelated base-only file.
[ "$(git diff --name-only "$base" "$head" | wc -l | tr -d ' ')" = 2 ]
[ "$("$script" pull_request "$base" "$head")" = front/ui-react/src/feature.test.ts ]
[ "$("$script" push "$initial" "$base")" = docs/base-only.md ]

git clone -q --depth=1 --branch feature "file://$test_root/origin" "$test_root/shallow"
cd "$test_root/shallow"
[ "$(git rev-parse --is-shallow-repository)" = true ]
[ "$("$script" pull_request "$base" "$head")" = front/ui-react/src/feature.test.ts ]
[ "$(git rev-parse --is-shallow-repository)" = false ]

# Failure must leave the workflow free to select all checks, not an empty pass.
if "$script" push 0000000000000000000000000000000000000000 "$head" > "$test_root/paths"; then exit 1; fi
[ ! -s "$test_root/paths" ]
git clone -q --depth=1 --branch feature "file://$test_root/origin" "$test_root/unavailable"
cd "$test_root/unavailable"
git remote set-url origin "$test_root/missing"
if "$script" pull_request "$base" "$head" > "$test_root/paths" 2>/dev/null; then exit 1; fi
[ ! -s "$test_root/paths" ]
if "$script" push deadbeef "$head" > "$test_root/paths" 2>/dev/null; then exit 1; fi
[ ! -s "$test_root/paths" ]
cd "$test_root/origin"
git checkout -q --orphan unrelated
git rm -q -rf .
echo unrelated > unrelated
git add .
git commit -qm unrelated
unrelated="$(git rev-parse HEAD)"
if "$script" pull_request "$base" "$unrelated" > "$test_root/paths" 2>/dev/null; then exit 1; fi
[ ! -s "$test_root/paths" ]
# Empty successful differences retain the existing conservative classification.
"$repo_root/tools/ci-changes.sh" < "$test_root/paths" > "$test_root/classification"
[ "$(grep -c '=true' "$test_root/classification")" = 5 ]
printf 'CI changed-path tests passed (divergence, push, shallow history and full-check fallbacks)\n'
