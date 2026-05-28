#!/usr/bin/env bash
# Backend integration smoke test against the LIVE Apps Script /exec endpoint.
# Verifies: config endpoints answer; append→read round-trips timestamp/date WITHOUT
# timezone shift; delete actually removes; no duplicate rows accumulate.
#
# Usage:  bash backend/smoke-test.sh
# Reads the URL from $VITE_API_URL, else from .env, else the hardcoded default.

set -u

URL="${VITE_API_URL:-}"
if [ -z "$URL" ] && [ -f .env ]; then
  URL=$(grep -E '^VITE_API_URL=' .env | head -1 | cut -d= -f2-)
fi
URL="${URL:-https://script.google.com/macros/s/AKfycbwok3O8A4Q-O9VwXwg_mczbcU29leqORsWXrko1D92QAJwtkoXHavQQGJAAELnNCZqf/exec}"

pass=0; fail=0
ok()   { echo "  PASS: $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL: $1"; fail=$((fail+1)); }

get()  { curl -L -s "$URL?action=$1"; }
post() { curl -L -s -X POST "$URL" -H 'Content-Type: text/plain;charset=utf-8' --data-raw "$1"; }

echo "== Backend smoke test =="
echo "URL: $URL"

# 1. config endpoints answer ok
echo "[1] config endpoints"
for a in plan habits polza logs; do
  r=$(get "$a")
  echo "$r" | grep -q '"ok":true' && ok "$a ok:true" || bad "$a -> $r"
done

# 2. plan non-empty
echo "[2] plan has exercises"
get plan | grep -q '"exercise"\|"name"' && ok "plan rows present" || bad "plan empty"

# 3. append round-trip: timestamp + date must come back UNCHANGED (no tz shift)
echo "[3] append round-trip (no tz shift)"
TS="2099-01-02T03:04:05.678"     # far-future sentinel so it can't collide
DT="2099-01-02"
post "{\"timestamp\":\"$TS\",\"date\":\"$DT\",\"week_iso\":99,\"day\":\"Чт\",\"exercise_id\":\"smoke_test\",\"exercise_name\":\"SMOKE\",\"set_number\":1}" >/dev/null
sleep 1
ROW=$(get logs | grep -o "{[^{}]*smoke_test[^{}]*}")
echo "    stored: $ROW"
echo "$ROW" | grep -q "\"timestamp\":\"$TS\"" && ok "timestamp round-trips ($TS)" || bad "timestamp shifted (expected $TS)"
echo "$ROW" | grep -q "\"date\":\"$DT\""       && ok "date round-trips ($DT)"      || bad "date shifted (expected $DT)"

# 4. delete removes the row
echo "[4] delete removes row"
post "{\"action\":\"delete\",\"timestamp\":\"$TS\"}" >/dev/null
sleep 1
CNT=$(get logs | grep -c "smoke_test")
[ "$CNT" -eq 0 ] && ok "row deleted (count 0)" || bad "row still present (count $CNT)"

# 5. no-dup: append once, read, ensure exactly one
echo "[5] single append = single row"
TS2="2099-01-02T03:04:06.000"
post "{\"timestamp\":\"$TS2\",\"date\":\"$DT\",\"week_iso\":99,\"day\":\"Чт\",\"exercise_id\":\"smoke_dup\",\"exercise_name\":\"DUP\",\"set_number\":1}" >/dev/null
sleep 1
CNT2=$(get logs | grep -c "smoke_dup")
[ "$CNT2" -eq 1 ] && ok "exactly one row" || bad "expected 1, got $CNT2"
# cleanup
post "{\"action\":\"delete\",\"timestamp\":\"$TS2\"}" >/dev/null

echo "== Result: $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
