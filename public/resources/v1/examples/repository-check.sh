#!/bin/sh
# Run explicitly or call by its actual absolute path from an EXISTING hook.
# No hook installation, core.hooksPath change, network or deployment.
set -eu
kit_examples=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$kit_examples/exercise.mjs"
