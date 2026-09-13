-- Cooperativa (ou cidadão-gestor) pode desfazer a confirmação do agendamento.

create or replace function public.desconfirmar_agendamento(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  alvo public.solicitacoes;
  autorizado boolean;
begin
  select * into alvo from public.solicitacoes where id = p_solicitacao_id;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;
  if alvo.status is distinct from 'confirmada' then
    raise exception 'Só é possível desconfirmar um agendamento já confirmado.';
  end if;

  autorizado := (
    public.sou_gestor_cooperativa()
    and alvo.cooperativa_id = public.meu_municipio()
  ) or alvo.operador_id = auth.uid();

  if not autorizado then
    raise exception 'Só quem confirmou o agendamento pode desconfirmar.';
  end if;

  update public.solicitacoes
  set status = 'agendada'
  where id = p_solicitacao_id;
end;
$func$;

grant execute on function public.desconfirmar_agendamento(uuid) to authenticated;
