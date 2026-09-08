# Photo schedule import

Adds photo/screenshot import inside the existing workout rotation editor, with
review before any program or exercise is saved. No dependencies or database
migrations are required.

## User flow

1. Open Program → Edit cycle → Import a workout photo.
2. Choose or capture one JPG, PNG or WebP image, up to 15 MB. The preview explains
   that Read schedule sends this photo to the existing AI service. Source images
   are not added to backups. Compression stays below the existing Worker cap.
3. Read, then check every workout against the expandable source image. Missing
   targets remain blank. Edit names, sets, rep ranges/durations and notes; remove,
   reorder or add missing exercises/workouts. Exact English/Arabic matches select
   library exercises. Unmatched names require an explicit library/custom choice.
4. Select training weekdays. Append to the current cycle, or explicitly confirm
   replacement. Logged sessions, weights and history remain untouched.
5. Edit saved targets from the cycle card. The guided workout displays them above
   the actual set inputs. Planned sets start empty and unchecked.

## Boundaries

- One photo per import; at most 14 workouts and 20 exercises per workout.
- This transcribes the printed schedule; it does not generate training advice.
- Sets are optional integers from 1 to 20. Reps/duration stay text so ranges,
  descending sequences and timed exercises are not flattened into invented reps.
  Printed weights, rest periods and tempo stay in notes, not completed records.
- Schedules use the app's continuous rotation. The user chooses weekdays; printed
  day names are labels, not a second fixed-week scheduling system.
- No draft writes before save. The atomic DB method rejects stale plan snapshots
  and rolls back both the cycle and any custom exercises on persistence failure.
- Authentication and the existing shared AI budget apply to the new Worker mode.
  Dismissing the modal ignores late responses and aborts the client request.

## Validation

`node scripts/test-plan-import.js` exercises production storage and Worker code
with Node built-ins and synthetic data: append/replace, untouched session history,
reload, target editing, duplicate saves, invalid drafts, disk-full rollback,
custom-exercise deduplication, target pruning, read-only mode, auth, fixed prompts,
input limits, empty results, quota denial and the existing food response path.

`node scripts/preview-plan-import.js` serves the actual app on
`http://127.0.0.1:8097` with synthetic auth and AI responses. Browser QA covered
file selection and compression, review, unresolved exercise validation, a custom
exercise, Arabic numerals, append and confirmed replacement, editing saved targets,
empty/quota/error responses, and guided targets remaining unchecked. Both EN/dark
and AR/light were checked at 390px; reviewed controls stayed at 16px and no modal
or review-row horizontal overflow was found. This verifies the app/protocol, not
Gemini's real transcription accuracy.

## Deployment status

**Worker deployed on 2026-09-08; client release v309.** Worker version
`ff0139be-7ff8-4082-b2c0-11fc16153a0c` was deployed with Wrangler 4.129.0 to
`vault-calories.moathdarweesh2000.workers.dev`. The preceding version was
`0d0ef588-fb2b-430e-948b-16b2c28520e9`. Compatibility date, RATE_LIMITER binding
and the existing GEMINI_KEY secret were preserved. OAuth required account/user
read, workers write and workers_scripts write scopes, plus offline access.

The deployed endpoint returned 401 for an unauthenticated workout-plan request
and 200 for the production-origin CORS preflight. Storage/Worker behavioral tests,
all 30 cross-file contracts and all 21 v309 release markers passed again before
publishing. Actual authenticated Gemini image transcription remains unverified;
the browser QA above used synthetic auth/model responses. Verify a schedule photo
through a signed-in account before treating transcription quality as confirmed.
Existing Android shells receive the web update; the bundled iOS distribution
needs its normal separate build/release.
