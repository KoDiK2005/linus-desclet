#!/bin/bash
# Wrapper for validate.py so it can be run as ./scripts/validate.sh from anywhere.
set -e
cd "$(dirname "$0")"
python3 validate.py
