-- Módulo do administrador: e-mail no perfil, função sou_admin()
-- e permissões para gerenciar municípios, materiais e papéis pelo app.
-- Execute DEPOIS do 0002_admin_papel.sql.

-- E-mail visível no painel do admin (o e-mail fica em auth.users, inacessível ao app).
alter table public.profiles add column if not exists email text;

update public.profiles p
  set email = u.email
  from auth.users u
  where u.id = p.id and p.email is null;

-- O gatilho de cadastro passa a gravar o e-mail também.
create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, municipio_id, nome, email, telefone, endereco, bairro)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'municipio_id')::uuid,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    new.raw_user_meta_data ->> 'telefone',
    new.raw_user_meta_data ->> 'endereco',
    new.raw_user_meta_data ->> 'bairro'
  );
  return new;
end;
$$;

create or replace function public.sou_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and papel = 'admin'
  );
$$;

-- Admin vê todos os perfis e altera papéis (cidadão <-> gestor).
-- Não pode promover outra conta a admin pelo app (só via SQL).
create policy "profiles_select_admin" on public.profiles
  for select using (public.sou_admin());

create policy "profiles_update_admin" on public.profiles
  for update using (public.sou_admin())
  with check (
    public.sou_admin()
    and (id = auth.uid() or papel in ('cidadao', 'gestor'))
  );

-- Admin gerencia municípios e materiais de qualquer contratante.
create policy "municipios_admin" on public.municipios
  for all using (public.sou_admin())
  with check (public.sou_admin());

create policy "materiais_admin" on public.materiais
  for all using (public.sou_admin())
  with check (public.sou_admin());

-- =============================================================
-- Para tornar uma conta administradora (troque o e-mail):
--
-- update public.profiles
--   set papel = 'admin'
--   where id = (select id from auth.users where email = 'voce@exemplo.com');
-- =============================================================
