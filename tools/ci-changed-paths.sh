#!/usr/bin/env bash
# Print changed paths, or fail so the caller selects all verification areas.
set -euo pipefail
if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <event> <base-sha> <head-sha>" >&2
  exit 2
fi
event="$1"
base="$2"
head="$3"
if [ "$base" = "0000000000000000000000000000000000000000" ]; then exit 1; fi

if [ "$event" = pull_request ]; then
  # A shallow boundary can hide the real merge base. Obtain complete ancestry,
  # or fail closed rather than treating the base tip as the PR's starting point.
  if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
    git fetch --no-tags --unshallow origin "$base" "$head" >&2 || exit 1
  elif ! git cat-file -e "$base^{commit}" 2>/dev/null || ! git cat-file -e "$head^{commit}" 2>/dev/null; then
    git fetch --no-tags origin "$base" "$head" >&2 || exit 1
  fi
  git diff --name-only "$base...$head"
else
  if ! git cat-file -e "$base^{commit}" 2>/dev/null || ! git cat-file -e "$head^{commit}" 2>/dev/null; then
    git fetch --no-tags --depth=1 origin "$base" "$head" >&2 || true
  fi
  git diff --name-only "$base" "$head"
fi
