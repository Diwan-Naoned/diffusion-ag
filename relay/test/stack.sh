#!/bin/sh
# docker compose wrapper for the local test stack: test/stack.sh up -d --build | logs -f relay | down
cd "$(dirname "$0")/.." || exit 1
exec docker compose -f docker-compose.yml -f test/compose.test.yml --env-file test/test.env "$@"
