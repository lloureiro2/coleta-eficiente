-- Salvar registro de coleta mesmo quando o material é da prefeitura
-- e quem registra é a cooperativa (RLS antigo exigia municipio_id = a conta).

create or replace function public.pode_registrar_coleta(p_solicitacao public.solicitacoes)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      public.sou_gestor_cooperativa()
      and p_solicitacao.cooperativa_id = public.meu_municipio()
    )
    or p_solicitacao.operador_id = auth.uid()
    or (
      public.sou_gestor_prefeitura()
      and p_solicitacao.municipio_id = public.meu_municipio()
    );
$$;

create or replace function public.registrar_coleta(
  p_solicitacao_id uuid,
  p_material_ids uuid[],
  p_kg numeric,
  p_unidades integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
declare
  alvo public.solicitacoes;
  novo_id uuid;
  municipio_registro uuid;
begin
  select * into alvo from public.solicitacoes where id = p_solicitacao_id;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;
  if not public.pode_registrar_coleta(alvo) then
    raise exception 'Você não pode registrar esta coleta.';
  end if;
  if p_material_ids is null or coalesce(array_length(p_material_ids, 1), 0) = 0 then
    raise exception 'Escolha o material coletado.';
  end if;
  if coalesce(p_kg, 0) <= 0 and coalesce(p_unidades, 0) <= 0 then
    raise exception 'Informe o peso (kg) ou a quantidade de unidades.';
  end if;

  municipio_registro := coalesce(public.meu_municipio(), alvo.municipio_id);

  insert into public.registros_coleta (
    municipio_id, solicitacao_id, material_id, kg, unidades
  ) values (
    municipio_registro, p_solicitacao_id, p_material_ids[1], coalesce(p_kg, 0), coalesce(p_unidades, 0)
  )
  returning id into novo_id;

  insert into public.registro_coleta_materiais (registro_id, material_id)
  select novo_id, unnest(p_material_ids)
  on conflict do nothing;

  return novo_id;
end;
$func$;

grant execute on function public.registrar_coleta(uuid, uuid[], numeric, integer) to authenticated;

drop policy if exists "registros_select" on public.registros_coleta;
create policy "registros_select" on public.registros_coleta
  for select using (
    public.sou_admin()
    or exists (
      select 1 from public.solicitacoes s
      where s.id = solicitacao_id and s.cidadao_id = auth.uid()
    )
    or (
      public.sou_gestor_cooperativa()
      and (
        municipio_id = public.meu_municipio()
        or exists (
          select 1 from public.solicitacoes s
          where s.id = solicitacao_id
            and s.cooperativa_id = public.meu_municipio()
        )
      )
    )
    or (
      public.sou_gestor_prefeitura()
      and (
        municipio_id = public.meu_municipio()
        or exists (
          select 1 from public.solicitacoes s
          where s.id = solicitacao_id
            and s.municipio_id = public.meu_municipio()
        )
      )
    )
  );
