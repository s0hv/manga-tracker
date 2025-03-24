#!/bin/bash
cd "$(dirname "$0")"/..
uv run protoc --proto_path=src/scrapers/mangaplus --python_out=src/scrapers/mangaplus --mypy_out=src/scrapers/mangaplus src/scrapers/mangaplus/protobuf/mangaplus.proto
