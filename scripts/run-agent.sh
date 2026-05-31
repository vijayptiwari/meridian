#!/usr/bin/env bash
set -euo pipefail

PORTAL="${1:-both}"
MODE="${2:-search}"
HEADED="${3:-false}"

export JOB_AGENT_PORTAL="$PORTAL"
export JOB_AGENT_MODE="$MODE"
export JOB_AGENT_HEADED="$HEADED"

node src/index.js
