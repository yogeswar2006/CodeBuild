#!/usr/bin/env bash
: "${TOKEN:?set TOKEN first: export TOKEN=...}"
: "${PID:?set PID, e.g. PID=<project-id> ./baseline.sh 1}"
C=${1:-1}; D=${2:-20}; BASE=http://localhost:5000/api/projects

run() {  # name method path [json-body without spaces]
  autocannon -c "$C" -d "$D" -m "$2" -j \
    -H "Cookie: jwt=$TOKEN" -H "Content-Type: application/json" \
    ${4:+-b "$4"} "$BASE$3" \
  | jq -r --arg n "$1" --arg c "$C" \
    '[$n, $c, (.requests.average|floor), .latency.p50, .latency.p97_5, .latency.p99, .latency.max, .non2xx, .errors] | @tsv'
}

echo -e "endpoint\tconn\treq/s\tp50ms\tp97.5ms\tp99ms\tmaxms\tnon2xx\terrors"
run "list projects" GET  ""
run "file tree"     GET  "/$PID/tree"
run "read file"     GET  "/$PID/file?path=package.json"
run "git status"    GET  "/$PID/git/status"
run "search"        POST "/$PID/search" '{"query":"const"}'
