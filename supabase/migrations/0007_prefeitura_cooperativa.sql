-- =============================================================
-- Vínculo prefeitura ↔ cooperativa, roteamento da coleta aprovada
-- e busca restrita de pessoas (e-mail/cidade) pela equipe.
-- Execute DEPOIS do 0006_status_aprovacao.sql.
-- =============================================================

alter table public.profiles
  add column if not exists cidade text,
  add column if not exists uf text;

create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $func$
begin
  insert into public.profiles (id, municipio_id, nome, email, telefone, endereco, bairro, cidade, uf)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'municipio_id', '')::uuid,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    new.raw_user_meta_data ->> 'telefone',
    new.raw_user_meta_data ->> 'endereco',
    new.raw_user_meta_data ->> 'bairro',
    new.raw_user_meta_data ->> 'cidade',
    new.raw_user_meta_data ->> 'uf'
  );
  return new;
end;
$func$;

create table if not exists public.prefeitura_cooperativas (
  prefeitura_id uuid not null references public.municipios (id) on delete cascade,
  cooperativa_id uuid not null references public.municipios (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prefeitura_id, cooperativa_id)
);

create or replace function public.validar_vinculo_cooperativa()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  if not exists (
    select 1 from public.municipios where id = new.prefeitura_id and tipo = 'prefeitura'
  ) then
    raise exception 'O vínculo precisa ter uma prefeitura no primeiro lado.';
  end if;
  if not exists (
    select 1 from public.municipios where id = new.cooperativa_id and tipo = 'cooperativa'
  ) then
    raise exception 'O vínculo precisa ter uma cooperativa no segundo lado.';
  end if;
  return new;
end;
$func$;

drop trigger if exists trg_validar_vinculo_cooperativa on public.prefeitura_cooperativas;
create trigger trg_validar_vinculo_cooperativa
  before insert or update on public.prefeitura_cooperativas
  for each row execute function public.validar_vinculo_cooperativa();

alter table public.solicitacoes
  add column if not exists cooperativa_id uuid references public.municipios (id);

create index if not exists idx_solicitacoes_cooperativa
  on public.solicitacoes (cooperativa_id, status);

insert into public.prefeitura_cooperativas (prefeitura_id, cooperativa_id)
select
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
where exists (select 1 from public.municipios where id = '33333333-3333-3333-3333-333333333333')
  and exists (select 1 from public.municipios where id = '44444444-4444-4444-4444-444444444444')
on conflict do nothing;

create or replace function public.meu_tipo()
returns public.tipo_municipio
language sql stable security definer
set search_path = public
as $func$
  select m.tipo
  from public.profiles p
  join public.municipios m on m.id = p.municipio_id
  where p.id = auth.uid();
$func$;

create or replace function public.sou_gestor_prefeitura()
returns boolean
language sql stable security definer
set search_path = public
as $func$
  select public.sou_gestor() and public.meu_tipo() = 'prefeitura';
$func$;

create or replace function public.sou_gestor_cooperativa()
returns boolean
language sql stable security definer
set search_path = public
as $func$
  select public.sou_gestor() and public.meu_tipo() = 'cooperativa';
$func$;

-- ---------- RLS do vínculo ----------

alter table public.prefeitura_cooperativas enable row level security;

drop policy if exists "vinculos_select" on public.prefeitura_cooperativas;
create policy "vinculos_select" on public.prefeitura_cooperativas
  for select using (
    public.sou_admin()
    or (
      public.sou_gestor()
      and (prefeitura_id = public.meu_municipio() or cooperativa_id = public.meu_municipio())
    )
  );

drop policy if exists "vinculos_insert" on public.prefeitura_cooperativas;
create policy "vinculos_insert" on public.prefeitura_cooperativas
  for insert with check (
    public.sou_admin()
    or (public.sou_gestor_prefeitura() and prefeitura_id = public.meu_municipio())
  );

drop policy if exists "vinculos_delete" on public.prefeitura_cooperativas;
create policy "vinculos_delete" on public.prefeitura_cooperativas
  for delete using (
    public.sou_admin()
    or (public.sou_gestor_prefeitura() and prefeitura_id = public.meu_municipio())
  );

-- ---------- Equipe: gestor não lista mais todos os sem vínculo ----------

drop policy if exists "profiles_select_gestor_equipe" on public.profiles;
create policy "profiles_select_gestor_equipe" on public.profiles
  for select using (
    public.sou_gestor() and municipio_id = public.meu_municipio()
    or (
      public.sou_gestor_prefeitura()
      and exists (
        select 1 from public.prefeitura_cooperativas v
        where v.prefeitura_id = public.meu_municipio()
          and v.cooperativa_id = profiles.municipio_id
      )
    )
  );

drop policy if exists "profiles_update_gestor_equipe" on public.profiles;
create policy "profiles_update_gestor_equipe" on public.profiles
  for update using (
    public.sou_gestor()
    and (
      municipio_id = public.meu_municipio()
      or municipio_id is null
      or (
        public.sou_gestor_prefeitura()
        and exists (
          select 1 from public.prefeitura_cooperativas v
          where v.prefeitura_id = public.meu_municipio()
            and v.cooperativa_id = profiles.municipio_id
        )
      )
    )
  )
  with check (
    public.sou_gestor()
    and papel in ('cidadao', 'gestor')
    and (
      municipio_id = public.meu_municipio()
      or (
        public.sou_gestor_prefeitura()
        and exists (
          select 1 from public.prefeitura_cooperativas v
          where v.prefeitura_id = public.meu_municipio()
            and v.cooperativa_id = profiles.municipio_id
        )
      )
    )
  );

create or replace function public.normalizar_texto(valor text)
returns text
language sql immutable
set search_path = public
as $func$
  select lower(trim(translate(
    valor,
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
  )));
$func$;

create or replace function public.buscar_pessoa_para_equipe(p_email text, p_cidade text)
returns setof public.profiles
language plpgsql security definer
set search_path = public
as $func$
declare
  email_busca text := lower(trim(coalesce(p_email, '')));
  cidade_busca text := public.normalizar_texto(coalesce(p_cidade, ''));
begin
  if not public.sou_gestor() and not public.sou_admin() then
    raise exception 'Não autorizado';
  end if;
  if char_length(email_busca) < 3 and char_length(cidade_busca) < 3 then
    return;
  end if;

  return query
  select p.*
  from public.profiles p
  where p.papel <> 'admin'
    and p.id <> auth.uid()
    and (
      (char_length(email_busca) >= 3 and lower(coalesce(p.email, '')) like '%' || email_busca || '%')
      or (
        char_length(cidade_busca) >= 3
        and (
          public.normalizar_texto(coalesce(p.cidade, '')) like '%' || cidade_busca || '%'
          or public.normalizar_texto(coalesce(p.bairro, '')) like '%' || cidade_busca || '%'
          or public.normalizar_texto(coalesce(p.endereco, '')) like '%' || cidade_busca || '%'
        )
      )
    )
    and (
      p.municipio_id is null
      or p.municipio_id = public.meu_municipio()
      or exists (
        select 1 from public.prefeitura_cooperativas v
        where v.prefeitura_id = public.meu_municipio()
          and v.cooperativa_id = p.municipio_id
      )
    );
end;
$func$;

grant execute on function public.buscar_pessoa_para_equipe(text, text) to authenticated;
grant execute on function public.normalizar_texto(text) to authenticated;

-- ---------- Solicitações: prefeitura vê as suas; cooperativa só as aprovadas dela ----------

drop policy if exists "solicitacoes_select" on public.solicitacoes;
create policy "solicitacoes_select" on public.solicitacoes
  for select using (
    cidadao_id = auth.uid()
    or (public.sou_gestor_prefeitura() and municipio_id = public.meu_municipio())
    or (
      public.sou_gestor_cooperativa()
      and cooperativa_id = public.meu_municipio()
      and status in ('aprovada', 'agendada', 'caminhao_a_caminho', 'coletada', 'cancelada')
    )
    or public.sou_admin()
  );

drop policy if exists "solicitacoes_update_gestor" on public.solicitacoes;
drop policy if exists "solicitacoes_update_prefeitura" on public.solicitacoes;
drop policy if exists "solicitacoes_update_cooperativa" on public.solicitacoes;
create policy "solicitacoes_update_prefeitura" on public.solicitacoes
  for update using (
    public.sou_gestor_prefeitura() and municipio_id = public.meu_municipio()
  )
  with check (
    public.sou_gestor_prefeitura()
    and municipio_id = public.meu_municipio()
    and (
      cooperativa_id is null
      or exists (
        select 1 from public.prefeitura_cooperativas v
        where v.prefeitura_id = public.meu_municipio()
          and v.cooperativa_id = cooperativa_id
      )
    )
  );

create policy "solicitacoes_update_cooperativa" on public.solicitacoes
  for update using (
    public.sou_gestor_cooperativa()
    and cooperativa_id = public.meu_municipio()
    and status in ('aprovada', 'agendada', 'caminhao_a_caminho', 'coletada', 'cancelada')
  )
  with check (
    public.sou_gestor_cooperativa()
    and cooperativa_id = public.meu_municipio()
  );

drop policy if exists "solicitacao_materiais_select" on public.solicitacao_materiais;
create policy "solicitacao_materiais_select" on public.solicitacao_materiais
  for select using (
    exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id
        and (
          s.cidadao_id = auth.uid()
          or (public.sou_gestor_prefeitura() and s.municipio_id = public.meu_municipio())
          or (
            public.sou_gestor_cooperativa()
            and s.cooperativa_id = public.meu_municipio()
            and s.status in ('aprovada', 'agendada', 'caminhao_a_caminho', 'coletada', 'cancelada')
          )
          or public.sou_admin()
        )
    )
  );

drop policy if exists "registros_select" on public.registros_coleta;
create policy "registros_select" on public.registros_coleta
  for select using (
    (public.sou_gestor() and municipio_id = public.meu_municipio())
    or exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id and s.cidadao_id = auth.uid()
    )
    or public.sou_admin()
  );
