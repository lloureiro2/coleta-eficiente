-- Resumo: prefeitura vê os registros de toda a equipe (cooperativas e gestores).
-- Cooperativa continua vendo só o que ela mesma registrou ou coletou.

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

drop policy if exists "registro_materiais_select" on public.registro_coleta_materiais;
create policy "registro_materiais_select" on public.registro_coleta_materiais
  for select using (
    exists (
      select 1 from public.registros_coleta r
      where r.id = registro_id
        and (
          public.sou_admin()
          or exists (
            select 1 from public.solicitacoes s
            where s.id = r.solicitacao_id and s.cidadao_id = auth.uid()
          )
          or (
            public.sou_gestor_cooperativa()
            and (
              r.municipio_id = public.meu_municipio()
              or exists (
                select 1 from public.solicitacoes s
                where s.id = r.solicitacao_id
                  and s.cooperativa_id = public.meu_municipio()
              )
            )
          )
          or (
            public.sou_gestor_prefeitura()
            and (
              r.municipio_id = public.meu_municipio()
              or exists (
                select 1 from public.solicitacoes s
                where s.id = r.solicitacao_id
                  and s.municipio_id = public.meu_municipio()
              )
            )
          )
        )
    )
  );
