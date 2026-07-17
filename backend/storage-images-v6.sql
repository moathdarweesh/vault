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
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Private bucket for user-uploaded exercise images.
--    public = false  → objects are NOT world-readable; every read goes through
--    the RLS policies below, so a user can only ever reach their own files.
--    Hardened with a 5 MB cap and an image-only mime allowlist (the client
--    already downscales to 800px/q0.78, so real uploads are ~50-150 KB).
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
--    Path convention: {auth.uid()}/{exercise_id}.jpg
--    storage.foldername(name))[1] is the first path segment = the owner's uid,
--    so a user can only read/write/delete under their own folder. Every policy
--    is scoped to bucket_id so it cannot affect any other bucket.
-- ---------------------------------------------------------------------------
drop policy if exists "exercise_images_owner_select" on storage.objects;
create policy "exercise_images_owner_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "exercise_images_owner_insert" on storage.objects;
create policy "exercise_images_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "exercise_images_owner_update" on storage.objects;
create policy "exercise_images_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "exercise_images_owner_delete" on storage.objects;
create policy "exercise_images_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 3) Where the durable copy lives, recorded on the mirrored exercise row so a
--    recovery from the mirror can restore the image (the whole point of this
--    migration). Nullable + additive: existing rows are untouched.
-- ---------------------------------------------------------------------------
alter table public.exercises add column if not exists image_path text;

comment on column public.exercises.image_path is
  'Storage path of the durable copy of a custom exercise image: {owner_id}/{exercise_id}.jpg in the private exercise-images bucket. NULL for global/catalog exercises and for customs whose image has not been backed up yet.';

-- ---------------------------------------------------------------------------
-- 4) Verification (read-only — run after applying).
-- ---------------------------------------------------------------------------
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'exercise-images';
-- select policyname, cmd from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname like 'exercise_images_%' order by policyname;
-- select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'exercises' and column_name = 'image_path';
