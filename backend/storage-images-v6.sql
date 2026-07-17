-- ===========================================================================
-- storage-images-v6.sql — durable storage for user-uploaded exercise images
--
-- WHY: custom exercise images (customImage) only ever lived as base64 INSIDE
-- the vault_data blob. The blob is a single mutable row with no history, so
-- when an empty local state overwrote it the images were destroyed — and the
-- mirror tables never held them, so they could not be recovered. This gives
-- every uploaded image an independent, durable home that survives a blob wipe.
--
-- MODEL: the base64 stays in the blob for display (instant + works offline in
-- the gym). Storage holds the durable BACKUP copy, and exercises.image_path
-- records where it lives so a mirror-based recovery can restore it.
--
-- SAFETY: additive only. No DROP/DELETE/TRUNCATE of data. The `drop policy if
-- exists` lines are idempotency guards for the policies this file creates, not
-- destructive operations. Safe to re-run.
--
-- Reviewed by db-security-auditor 2026-07-17: no Critical, cross-user
-- isolation sound and fail-closed on crafted names — CONDITIONAL on the
-- STEP 0 pre-flight below. Findings M-1 (path-shape pin) and L-1 (initplan
-- form) are applied. Open follow-ups, tracked but NOT blocking this file:
--   H-3  storage.objects has no FK to auth.users → images are not erased when
--        an account is deleted. Needs a server-side list(uid)+remove() sweep
--        in a delete-account routine before that feature ships.
--   M-2  user_exercise_prefs.custom_image_path (schema-v2.sql:150) was the
--        originally designated pointer and is already populated. This file
--        adds exercises.image_path instead (it is what the mirror upserts).
--        Two sources of truth for one fact — pick one deliberately.
-- ===========================================================================


-- ###########################################################################
-- ## STEP 0 — MANDATORY READ-ONLY PRE-FLIGHT. Run this FIRST, on its own.  ##
-- ##                                                                       ##
-- ## Permissive RLS policies are OR-combined. schema-v2.sql told the owner ##
-- ## to create the `avatars` policies in the Storage UI, whose quick-start ##
-- ## templates include `using (true)` with NO bucket_id scope. ONE such    ##
-- ## legacy policy grants SELECT on EVERY bucket — including this one —    ##
-- ## and silently defeats every owner-check below.                         ##
-- ##                                                                       ##
-- ## Expected: rowsecurity = true, and EVERY policy has a `bucket_id =`    ##
-- ## scope. Any policy whose qual is `true` / has no bucket_id is a HARD   ##
-- ## BLOCKER — stop and drop it before applying the rest of this file.     ##
-- ###########################################################################
-- select relrowsecurity as rls_on from pg_class where oid = 'storage.objects'::regclass;
-- select policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname = 'storage' and tablename = 'objects'
--   order by policyname;


-- ---------------------------------------------------------------------------
-- 1) Private bucket for user-uploaded exercise images.
--    public = false  → objects are NOT world-readable; every read goes through
--    the RLS policies below, so a user can only ever reach their own files.
--    Hardened with a 5 MB cap and an image-only mime allowlist (the client
--    already downscales to 800px/q0.78, so real uploads are ~50-150 KB).
--
--    ⚠️ image/svg+xml MUST stay out of this allowlist. The client accepts any
--    image/* it finds in a data URL, and a poisoned imported backup could
--    carry an SVG (an active-content/XSS vector). This allowlist is what
--    rejects it — it is load-bearing security, not a nicety.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-images',
  'exercise-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2) Owner-only RLS on the objects in THIS bucket.
--    Path convention: {auth.uid()}/{exercise_id}.jpg — EXACTLY one folder deep.
--
--    (storage.foldername(name))[1] is the first path segment = the owner's uid.
--    Verified fail-closed: a name with no folder yields NULL, a leading slash
--    yields '' — both compare false, so access is denied rather than granted.
--
--    array_length(...) = 1 pins the shape to exactly one segment. This blocks
--    `uidA/../uidB/x.jpg` and nested keys. Neither is a break today (S3 keys
--    are stored literally and are never resolved), but it removes the whole
--    class ahead of any future component that might normalise `..`, and it
--    keeps every object findable under a plain `{uid}/` prefix — which an
--    account-deletion sweep (H-3) depends on.
--
--    (select auth.uid()) — project convention: evaluated once as an initplan
--    instead of per row.
-- ---------------------------------------------------------------------------
drop policy if exists "exercise_images_owner_select" on storage.objects;
create policy "exercise_images_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

drop policy if exists "exercise_images_owner_insert" on storage.objects;
create policy "exercise_images_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

-- UPDATE carries BOTH clauses on purpose: USING stops a user touching someone
-- else's row, WITH CHECK stops them renaming their own row INTO another user's
-- folder. Dropping either one re-opens a cross-folder move.
drop policy if exists "exercise_images_owner_update" on storage.objects;
create policy "exercise_images_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  )
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

drop policy if exists "exercise_images_owner_delete" on storage.objects;
create policy "exercise_images_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

-- ---------------------------------------------------------------------------
-- 3) Where the durable copy lives, recorded on the mirrored exercise row so a
--    recovery from the mirror can restore the image (the whole point of this
--    migration). Nullable + additive: existing rows are untouched, no rewrite.
-- ---------------------------------------------------------------------------
alter table public.exercises add column if not exists image_path text;

comment on column public.exercises.image_path is
  'Storage path of the durable copy of a custom exercise image: {owner_id}/{exercise_id}.jpg in the private exercise-images bucket. NULL for global/catalog exercises and for customs whose image has not been backed up yet.';

-- ---------------------------------------------------------------------------
-- 4) Verification (read-only — run after applying).
--    NOTE: intentionally does NOT filter to 'exercise_images_%'. A legacy
--    unscoped policy is exactly what would defeat this file, so the whole
--    policy list must be eyeballed — see STEP 0.
-- ---------------------------------------------------------------------------
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'exercise-images';
-- select policyname, cmd, qual, with_check from pg_policies
--   where schemaname = 'storage' and tablename = 'objects' order by policyname;
-- select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'exercises' and column_name = 'image_path';
