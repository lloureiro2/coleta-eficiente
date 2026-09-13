-- Ao agendar, a prefeitura escolhe cooperativa OU cidadão-gestor.
-- operador_id = cidadão promovido a gestor responsável pela coleta.

alter table public.solicitacoes
  add column if not exists operador_id uuid references public.profiles (id);

create index if not exists idx_solicitacoes_operador
  on public.solicitacoes (operador_id, status);

create or replace function public.sou_gestor_institucional()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and papel = 'gestor'
      and conta_institucional = true
  );
$$;

drop policy if exists "solicitacoes_update_prefeitura" on public.solicitacoes;
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
    and (
      operador_id is null
      or exists (
        select 1 from public.profiles p
        where p.id = operador_id
          and p.municipio_id = public.meu_municipio()
          and p.papel = 'gestor'
          and coalesce(p.conta_institucional, false) = false
      )
    )
  );
