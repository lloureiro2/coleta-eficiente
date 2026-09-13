-- Um registro de coleta pode ter vários materiais (mistura) ou um só (separado).

create table if not exists public.registro_coleta_materiais (
  registro_id uuid not null references public.registros_coleta (id) on delete cascade,
  material_id uuid not null references public.materiais (id) on delete cascade,
  primary key (registro_id, material_id)
);

alter table public.registro_coleta_materiais enable row level security;

insert into public.registro_coleta_materiais (registro_id, material_id)
select id, material_id
from public.registros_coleta
on conflict do nothing;

drop policy if exists "registro_materiais_select" on public.registro_coleta_materiais;
create policy "registro_materiais_select" on public.registro_coleta_materiais
  for select using (
    exists (
      select 1 from public.registros_coleta r
      where r.id = registro_id
        and (
          (public.sou_gestor() and r.municipio_id = public.meu_municipio())
          or exists (
            select 1 from public.solicitacoes s
            where s.id = r.solicitacao_id and s.cidadao_id = auth.uid()
          )
          or public.sou_admin()
        )
    )
  );

drop policy if exists "registro_materiais_gestor" on public.registro_coleta_materiais;
create policy "registro_materiais_gestor" on public.registro_coleta_materiais
  for all using (
    public.sou_gestor()
    and exists (
      select 1 from public.registros_coleta r
      where r.id = registro_id and r.municipio_id = public.meu_municipio()
    )
  )
  with check (
    public.sou_gestor()
    and exists (
      select 1 from public.registros_coleta r
      where r.id = registro_id and r.municipio_id = public.meu_municipio()
    )
  );
