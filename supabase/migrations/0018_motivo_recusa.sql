-- Motivo obrigatório ao recusar a solicitação (prefeitura)
-- ou o agendamento (cooperativa / cidadão-gestor).

alter table public.solicitacoes
  add column if not exists motivo_recusa text,
  add column if not exists origem_recusa text;

alter table public.solicitacoes
  drop constraint if exists solicitacoes_origem_recusa_check;

alter table public.solicitacoes
  add constraint solicitacoes_origem_recusa_check
  check (origem_recusa is null or origem_recusa in ('prefeitura', 'cooperativa', 'gestor'));

drop function if exists public.responder_agendamento(uuid, boolean);

create or replace function public.responder_agendamento(
  p_solicitacao_id uuid,
  p_aceitar boolean,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  alvo public.solicitacoes;
  autorizado boolean;
  motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  origem text;
begin
  select * into alvo from public.solicitacoes where id = p_solicitacao_id;
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;
  if alvo.status is distinct from 'agendada' then
    raise exception 'Só é possível responder um agendamento pendente.';
  end if;

  autorizado := (
    public.sou_gestor_cooperativa()
    and alvo.cooperativa_id = public.meu_municipio()
  ) or alvo.operador_id = auth.uid();

  if not autorizado then
    raise exception 'Só quem foi escolhido para coletar pode responder este agendamento.';
  end if;

  if p_aceitar then
    update public.solicitacoes
    set
      status = 'confirmada',
      motivo_recusa = null,
      origem_recusa = null
    where id = p_solicitacao_id;
    return;
  end if;

  if motivo is null or char_length(motivo) < 3 then
    raise exception 'Informe o motivo da recusa.';
  end if;

  origem := case
    when public.sou_gestor_cooperativa() then 'cooperativa'
    else 'gestor'
  end;

  update public.solicitacoes
  set
    status = 'aprovada',
    cooperativa_id = null,
    operador_id = null,
    motivo_recusa = motivo,
    origem_recusa = origem
  where id = p_solicitacao_id;
end;
$func$;

grant execute on function public.responder_agendamento(uuid, boolean, text) to authenticated;
