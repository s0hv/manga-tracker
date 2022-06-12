#!/bin/bash


if [[ -z "${SKIP_POSTINSTALL}" ]]; then
else
  cd "$(dirname "$0")"/../web
  npm ci
fi

