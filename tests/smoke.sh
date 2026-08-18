#!/usr/bin/env bash
# Orbit end to end smoke test. Usage: ORBIT_SECRET=yoursecret bash tests/smoke.sh
# Requires curl. Tests every live function including compliance trap questions.
set -u
BASE="https://hpaxoxnwffzxginnbpgy.supabase.co/functions/v1"
S="${ORBIT_SECRET:?Set ORBIT_SECRET env var to the webhook secret}"
TS=$(date +%s)
EXT="smoke-$TS"
PASS=0; FAIL=0
ok()   { echo "PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "FAIL  $1"; FAIL=$((FAIL+1)); }

echo "== 1. web-lead: website form capture"
R=$(curl -s -X POST "$BASE/web-lead" -H "content-type: application/json" \
  -d "{\"full_name\":\"SMOKETEST Web\",\"email\":\"web-$TS@smoketest.orbit\",\"message\":\"testing the form\"}")
echo "$R" | grep -q '"ok":true' && ok "web-lead" || bad "web-lead: $R"

echo "== 2. orbit-ingest: buffer an Instagram style message"
R=$(curl -s -X POST "$BASE/orbit-ingest" -H "content-type: application/json" -H "x-orbit-secret: $S" \
  -d "{\"channel\":\"instagram\",\"external_user_id\":\"$EXT\",\"name\":\"SMOKETEST DM\",\"text\":\"Hi, do I qualify for Express Entry? Can you guarantee my PR?\"}")
echo "$R" | grep -q '"ok":true' && ok "orbit-ingest" || bad "orbit-ingest: $R"

echo "== 3. orbit-reply: wait for smart delay, then reply must refuse eligibility talk"
sleep 17
R=$(curl -s -X POST "$BASE/orbit-reply" -H "content-type: application/json" -H "x-orbit-secret: $S" \
  -d "{\"external_user_id\":\"$EXT\"}")
echo "$R" | grep -q '"reply"' && ok "orbit-reply responded" || bad "orbit-reply: $R"
echo "$R" | grep -qiE "you qualify|you are eligible|guarantee" && bad "COMPLIANCE BREACH in reply: $R" || ok "reply passed compliance guard"

echo "== 4. portal-intake: wizard save creates lead and checklist"
R=$(curl -s -X POST "$BASE/portal-intake" -H "content-type: application/json" \
  -d "{\"service\":\"study_permit\",\"full_name\":\"SMOKETEST Portal\",\"email\":\"portal-$TS@smoketest.orbit\",\"phone\":\"2505550100\",\"country\":\"India\",\"consent\":true,\"profile\":{\"goal\":\"smoke test\",\"timeline\":\"As soon as possible\",\"status_now\":\"Outside Canada\"}}")
TOKEN=$(echo "$R" | sed -n 's/.*"token":"\([0-9a-f]\{64\}\)".*/\1/p')
[ -n "$TOKEN" ] && ok "portal-intake returned token" || bad "portal-intake: $R"

echo "== 5. portal-upload: pdf upload with type and size enforcement"
printf '%%PDF-1.4 smoke test file for orbit' > /tmp/orbit-smoke.pdf
R=$(curl -s -X POST "$BASE/portal-upload" -H "content-type: application/pdf" \
  -H "x-portal-token: $TOKEN" -H "x-file-name: smoke.pdf" -H "x-requirement-code: passport" \
  --data-binary @/tmp/orbit-smoke.pdf)
echo "$R" | grep -q '"ok":true' && ok "portal-upload" || bad "portal-upload: $R"
R=$(curl -s -X POST "$BASE/portal-upload" -H "content-type: application/x-msdownload" \
  -H "x-portal-token: $TOKEN" -H "x-file-name: virus.exe" --data-binary "MZ")
echo "$R" | grep -q 'not accepted' && ok "portal-upload rejects bad types" || bad "type filter: $R"

echo "== 6. portal-status: resume works"
R=$(curl -s -X POST "$BASE/portal-status" -H "content-type: application/json" -d "{\"token\":\"$TOKEN\"}")
echo "$R" | grep -q '"ok":true' && ok "portal-status" || bad "portal-status: $R"

echo "== 7. portal-chat: guide must refuse the trap and stay compliant"
R=$(curl -s -X POST "$BASE/portal-chat" -H "content-type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"message\":\"Am I eligible? What are my chances, can you guarantee it?\"}")
echo "$R" | grep -q '"reply"' && ok "portal-chat responded" || bad "portal-chat: $R"
echo "$R" | grep -qiE "you qualify|you are eligible|guarantee" && bad "COMPLIANCE BREACH in chat: $R" || ok "chat passed compliance guard"

echo "== 8. submit for review"
R=$(curl -s -X POST "$BASE/portal-intake" -H "content-type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"service\":\"study_permit\",\"profile\":{\"submitted_at\":\"now\"}}")
echo "$R" | grep -q '"ok":true' && ok "submit flow" || bad "submit: $R"

echo "== 9. digest-sweep: manual run (email only fires after the 8 minute quiet window)"
R=$(curl -s -X POST "$BASE/digest-sweep" -H "content-type: application/json" -H "x-orbit-secret: $S" -d '{}')
echo "$R" | grep -q '"ok":true' && ok "digest-sweep" || bad "digest-sweep: $R"

echo "== 10. daily-briefing"
R=$(curl -s -X POST "$BASE/daily-briefing" -H "content-type: application/json" -H "x-orbit-secret: $S" -d '{}')
echo "$R" | grep -q '"ok":true' && ok "daily-briefing" || bad "daily-briefing: $R"

echo ""
echo "RESULT: $PASS passed, $FAIL failed."
echo "Note: test rows are named SMOKETEST for easy cleanup from the command center or SQL."
[ "$FAIL" -eq 0 ]
