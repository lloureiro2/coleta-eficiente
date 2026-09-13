-- Atrelar cooperativa também promove a conta de acesso dela a gestor,
-- senão a coleta agendada não aparece no painel da cooperativa.

create or replace function public.atrelar_cooperativa(p_cooperativa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  tipo public.tipo_municipio;
begin
  if not public.sou_gestor_prefeitura() then
    raise exception 'Só a prefeitura pode atrelar uma cooperativa.';
  end if;

  select m.tipo into tipo from public.municipios m where m.id = p_cooperativa_id;
  if tipo is distinct from 'cooperativa' then
    raise exception 'O contratante informado não é uma cooperativa.';
  end if;

  insert into public.prefeitura_cooperativas (prefeitura_id, cooperativa_id)
  values (public.meu_municipio(), p_cooperativa_id)
  on conflict do nothing;

  update public.profiles
  set papel = 'gestor'
  where municipio_id = p_cooperativa_id;
end;
$func$;

grant execute on function public.atrelar_cooperativa(uuid) to authenticated;

-- Cooperativas já atreladas sem acesso de gestor passam a ver as coletas.
update public.profiles p
set papel = 'gestor'
from public.prefeitura_cooperativas v
where p.municipio_id = v.cooperativa_id
  and p.papel <> 'gestor';

-- Coletas já aprovadas/agendadas sem destino: se a prefeitura tem só uma
-- cooperativa atrelada, ela passa a receber essas coletas.
update public.solicitacoes s
set cooperativa_id = unica.cooperativa_id
from (
  select prefeitura_id, (array_agg(cooperativa_id))[1] as cooperativa_id
  from public.prefeitura_cooperativas
  group by prefeitura_id
  having count(*) = 1
) unica
where s.municipio_id = unica.prefeitura_id
  and s.cooperativa_id is null
  and s.operador_id is null
  and s.status in ('aprovada', 'agendada', 'caminhao_a_caminho');
