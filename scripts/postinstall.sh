#!/bin/bash

if [[ -z "${SKIP_POSTINSTALL}" ]]; then
  exit 0
else
  cd "$(dirname "$0")"/../web
  npm ci
fi

