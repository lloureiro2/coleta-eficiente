-- Desvincular pessoa da equipe. Não dá para fazer por UPDATE direto: a policy
-- profiles_update_gestor_equipe exige municipio_id = meu_municipio() no WITH CHECK,
-- então deixar o vínculo nulo seria sempre recusado.

create or replace function public.desvincular_pessoa_equipe(p_pessoa_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $func$
declare
  meu_contratante uuid := public.meu_municipio();
  pessoa public.profiles;
begin
  if not public.sou_gestor() then
    raise exception 'Só a prefeitura ou a cooperativa pode desvincular pessoas da equipe.';
  end if;
  if meu_contratante is null then
    raise exception 'Sua conta não está vinculada a uma prefeitura ou cooperativa.';
  end if;

  select * into pessoa from public.profiles where id = p_pessoa_id;
  if pessoa.id is null then
    raise exception 'Pessoa não encontrada.';
  end if;
  if pessoa.id = auth.uid() then
    raise exception 'Você não pode desvincular a própria conta.';
  end if;
  if pessoa.municipio_id is distinct from meu_contratante then
    raise exception 'Esta pessoa não faz parte da sua equipe.';
  end if;
  if pessoa.papel = 'admin' or coalesce(pessoa.conta_institucional, false) then
    raise exception 'Esta conta não pode ser desvinculada.';
  end if;
  if exists (
    select 1
    from public.solicitacoes s
    where s.operador_id = p_pessoa_id
      and s.status in ('aprovada', 'agendada', 'confirmada', 'caminhao_a_caminho')
  ) then
    raise exception 'Esta pessoa ainda responde por coletas em andamento. Encaminhe as coletas para outra pessoa antes de desvincular.';
  end if;

  update public.profiles
  set municipio_id = null,
      papel = 'cidadao'
  where id = p_pessoa_id
  returning * into pessoa;

  return pessoa;
end;
$func$;

grant execute on function public.desvincular_pessoa_equipe(uuid) to authenticated;
