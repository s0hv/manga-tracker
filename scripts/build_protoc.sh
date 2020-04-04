#!/bin/bash
cd "$(dirname "$0")"/..
protoc --proto_path=src/scrapers/mangaplus --python_out=src/scrapers/mangaplus src/scrapers/mangaplus/protobuf/mangaplus.proto