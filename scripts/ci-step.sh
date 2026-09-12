#!/usr/bin/env bash
# ci-step — run a command, and if it fails, re-emit its output as a GitHub
# ANNOTATION so the failure can be read without admin rights on the repository.
#
# WHY THIS EXISTS
# A workflow's run log is admin-only: the REST logs endpoint answers
#   403 {"message": "Must have admin rights to Repository."}
# to everyone else, and there is no public equivalent. So on a red build all a
# non-admin can see is which STEP failed, never why. That is not a hypothetical
# inconvenience here — the maintainer works from a machine with no Mac and no
# repo-admin token, so an iOS failure was a red X with no text attached to it,
# and the only way to learn anything was to guess, push, and look again.
#
# check-run ANNOTATIONS, unlike logs, are public on a public repository:
#   GET /repos/{owner}/{repo}/check-runs/{id}/annotations   -> 200
# So every failure is copied there. The build still prints normally to the log
# for anyone who can read it; this only adds a second, readable channel.
#
# Annotation text is single-line: newlines must travel as %0A and a literal
# percent as %25, or GitHub truncates the message at the first newline. The
# awk below does exactly that, escaping % FIRST so the escapes it writes are
# not re-escaped. The tail is capped because an annotation is not a log.
set -o pipefail

LABEL="$1"
shift

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

echo "+ $*"
"$@" 2>&1 | tee "$OUT"
STATUS=${PIPESTATUS[0]}

if [ "$STATUS" -ne 0 ]; then
  DETAIL=$(tail -c 4000 "$OUT" | awk '{gsub(/%/,"%25"); gsub(/\r/,"%0D"); printf "%s%%0A", $0}')
  echo "::error title=${LABEL} failed (exit ${STATUS})::${DETAIL}"
fi

exit "$STATUS"
