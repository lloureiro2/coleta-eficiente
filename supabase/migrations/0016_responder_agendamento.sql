-- A cooperativa confirma ou recusa o agendamento.
-- Recusar devolve a coleta à prefeitura (aprovada, sem destino).

create or replace function public.responder_agendamento(
  p_solicitacao_id uuid,
  p_aceitar boolean
)
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
    set status = 'confirmada'
    where id = p_solicitacao_id;
  else
    update public.solicitacoes
    set
      status = 'aprovada',
      cooperativa_id = null,
      operador_id = null
    where id = p_solicitacao_id;
  end if;
end;
$func$;

grant execute on function public.responder_agendamento(uuid, boolean) to authenticated;

drop policy if exists "solicitacoes_select" on public.solicitacoes;
create policy "solicitacoes_select" on public.solicitacoes
  for select using (
    cidadao_id = auth.uid()
    or (public.sou_gestor_prefeitura() and municipio_id = public.meu_municipio())
    or (
      public.sou_gestor_cooperativa()
      and cooperativa_id = public.meu_municipio()
      and status in ('aprovada', 'agendada', 'confirmada', 'caminhao_a_caminho', 'coletada', 'cancelada')
    )
    or public.sou_admin()
  );

drop policy if exists "solicitacoes_update_cooperativa" on public.solicitacoes;
create policy "solicitacoes_update_cooperativa" on public.solicitacoes
  for update using (
    public.sou_gestor_cooperativa()
    and cooperativa_id = public.meu_municipio()
    and status in ('agendada', 'confirmada', 'caminhao_a_caminho', 'coletada', 'cancelada')
  )
  with check (
    public.sou_gestor_cooperativa()
    and cooperativa_id = public.meu_municipio()
    and status in ('confirmada', 'caminhao_a_caminho', 'coletada', 'cancelada')
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
            and s.status in ('aprovada', 'agendada', 'confirmada', 'caminhao_a_caminho', 'coletada', 'cancelada')
          )
          or public.sou_admin()
        )
    )
  );
