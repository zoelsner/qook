-- ============================================================
-- Qook storage buckets + RLS on storage.objects
-- Source: docs/plan/section-backend.md §5
-- ============================================================

-- 5.1 meal-images (public CDN, service-role writes)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-images', 'meal-images', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "public read meal-images" on storage.objects for select
  using (bucket_id = 'meal-images');

-- 5.2 cohort-decks (public JSON, service-role writes)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cohort-decks', 'cohort-decks', true, 1048576, array['application/json'])
on conflict (id) do nothing;

create policy "public read cohort-decks" on storage.objects for select
  using (bucket_id = 'cohort-decks');

-- 5.3 user-uploads (private, per-user folder)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-uploads', 'user-uploads', false, 10485760,
  array['image/png', 'image/jpeg', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

create policy "users upload own folder" on storage.objects for insert
  with check (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own folder" on storage.objects for select
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own folder" on storage.objects for delete
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
