-- Monitoring Copart BSD: skema Supabase.
-- Jalankan sekali di SQL Editor project (aman dijalankan ulang).

-- ---------- Tabel ----------
create table if not exists public.members (
  email      text primary key check (email = lower(email)),
  nama       text,
  role       text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.copart (
  id         uuid primary key default gen_random_uuid(),
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint copart_nama_valid check (
    jsonb_typeof(data -> 'nama') = 'string'
    and length(data ->> 'nama') between 1 and 200
  )
);

-- ---------- Peran pengguna saat ini ----------
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.members m
  where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- ---------- Row Level Security ----------
alter table public.members enable row level security;
alter table public.copart  enable row level security;

revoke all on public.members from anon;
revoke all on public.copart  from anon;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.copart  to authenticated;

drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (public.my_role() is not null or email = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists members_insert on public.members;
create policy members_insert on public.members for insert to authenticated
  with check (public.my_role() = 'admin');

drop policy if exists members_update on public.members;
create policy members_update on public.members for update to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete to authenticated
  using (public.my_role() = 'admin' and email <> lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists copart_select on public.copart;
create policy copart_select on public.copart for select to authenticated
  using (public.my_role() is not null);

drop policy if exists copart_insert on public.copart;
create policy copart_insert on public.copart for insert to authenticated
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists copart_update on public.copart;
create policy copart_update on public.copart for update to authenticated
  using (public.my_role() in ('admin', 'editor'))
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists copart_delete on public.copart;
create policy copart_delete on public.copart for delete to authenticated
  using (public.my_role() in ('admin', 'editor'));

-- ---------- Realtime ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'copart'
  ) then
    alter publication supabase_realtime add table public.copart;
  end if;
end $$;

-- ---------- Storage: bucket dokumen (privat, maks 20 MB) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dokumen', 'dokumen', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists dokumen_select on storage.objects;
create policy dokumen_select on storage.objects for select to authenticated
  using (bucket_id = 'dokumen' and public.my_role() is not null);

drop policy if exists dokumen_insert on storage.objects;
create policy dokumen_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumen' and public.my_role() in ('admin', 'editor'));

drop policy if exists dokumen_delete on storage.objects;
create policy dokumen_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dokumen' and public.my_role() in ('admin', 'editor'));

-- ---------- Admin pertama ----------
-- Ganti email dan nama di bawah dengan admin BSD Anda sebelum menjalankan.
insert into public.members (email, nama, role, created_by)
values ('admin@contoh.co.id', 'Nama Admin', 'admin', 'setup')
on conflict (email) do nothing;
