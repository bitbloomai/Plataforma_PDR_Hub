-- =========================================================
-- FOTOS DOS SERVIÇOS
-- Bucket privado + tabela de metadados + políticas por conta.
-- Pode ser executado mais de uma vez sem erro.
-- =========================================================

-- 1. Bucket privado (máx. 10 MB por arquivo, somente imagens)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'servicos-fotos',
  'servicos-fotos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2. Conta do usuário logado (usado pelas políticas)
create or replace function public.pdr_conta_do_usuario()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.conta_id
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.ativo = true
  limit 1
$$;

revoke all on function public.pdr_conta_do_usuario() from public;
grant execute on function public.pdr_conta_do_usuario() to authenticated;

-- 3. Tabela de fotos
create table if not exists public.servicos_fotos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  storage_path text not null unique,
  nome_arquivo text,
  tamanho_bytes integer,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists servicos_fotos_servico_idx
  on public.servicos_fotos (conta_id, servico_id, created_at);

alter table public.servicos_fotos enable row level security;

drop policy if exists "servicos_fotos_select" on public.servicos_fotos;
create policy "servicos_fotos_select" on public.servicos_fotos
  for select to authenticated
  using (conta_id = public.pdr_conta_do_usuario());

drop policy if exists "servicos_fotos_insert" on public.servicos_fotos;
create policy "servicos_fotos_insert" on public.servicos_fotos
  for insert to authenticated
  with check (
    conta_id = public.pdr_conta_do_usuario()
    and exists (
      select 1 from public.servicos s
      where s.id = servico_id
        and s.conta_id = servicos_fotos.conta_id
    )
    and split_part(storage_path, '/', 1) = conta_id::text
  );

drop policy if exists "servicos_fotos_delete" on public.servicos_fotos;
create policy "servicos_fotos_delete" on public.servicos_fotos
  for delete to authenticated
  using (conta_id = public.pdr_conta_do_usuario());

-- 4. Políticas do bucket: cada conta só acessa a própria pasta
--    Caminho dos arquivos: {conta_id}/{servico_id}/{arquivo}
drop policy if exists "servicos_fotos_storage_select" on storage.objects;
create policy "servicos_fotos_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'servicos-fotos'
    and (storage.foldername(name))[1] = public.pdr_conta_do_usuario()::text
  );

drop policy if exists "servicos_fotos_storage_insert" on storage.objects;
create policy "servicos_fotos_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'servicos-fotos'
    and (storage.foldername(name))[1] = public.pdr_conta_do_usuario()::text
  );

drop policy if exists "servicos_fotos_storage_update" on storage.objects;
create policy "servicos_fotos_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'servicos-fotos'
    and (storage.foldername(name))[1] = public.pdr_conta_do_usuario()::text
  )
  with check (
    bucket_id = 'servicos-fotos'
    and (storage.foldername(name))[1] = public.pdr_conta_do_usuario()::text
  );

drop policy if exists "servicos_fotos_storage_delete" on storage.objects;
create policy "servicos_fotos_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'servicos-fotos'
    and (storage.foldername(name))[1] = public.pdr_conta_do_usuario()::text
  );
