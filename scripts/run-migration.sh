#!/bin/bash
# Run a SQL migration against Supabase via the exec_sql RPC function.
# Usage: bash scripts/run-migration.sh <migration-file.sql>
#
# Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

set -e

if [ -z "$1" ]; then
  echo "Usage: bash scripts/run-migration.sh <path-to-sql-file>"
  exit 1
fi

SQL_FILE="$1"
if [ ! -f "$SQL_FILE" ]; then
  echo "Error: File not found: $SQL_FILE"
  exit 1
fi

# Load env vars
set -a
source .env.local 2>/dev/null || true
set +a

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  exit 1
fi

SQL_CONTENT=$(cat "$SQL_FILE")

echo "Running migration: $SQL_FILE"

# Use node to JSON-escape the SQL content (no jq dependency)
JSON_BODY=$(node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ console.log(JSON.stringify({sql:d})); });" <<< "$SQL_CONTENT")

RESPONSE=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON_BODY")

if echo "$RESPONSE" | grep -q '"success" *: *true'; then
  echo "Migration succeeded."
else
  echo "Migration FAILED."
  echo "Response: $RESPONSE"
  exit 1
fi
