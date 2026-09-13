-- =============================================================
-- Roteamento da solicitação para a prefeitura da cidade
-- (ex.: coleta em Vitória chega na Prefeitura de Vitória)
-- e endereço estruturado via CEP.
-- Execute DEPOIS do 0003_admin.sql.
-- =============================================================

alter table public.solicitacoes
  add column if not exists cep text,
  add column if not exists cidade text,
  add column if not exists uf text;

-- Cidadão pode enviar a coleta para a prefeitura da cidade do endereço,
-- não só para o município escolhido no cadastro.
drop policy if exists "solicitacoes_insert" on public.solicitacoes;
create policy "solicitacoes_insert" on public.solicitacoes
  for insert with check (cidadao_id = auth.uid());

-- Materiais de qualquer contratante ficam visíveis para o cidadão escolher
-- os aceitos pela prefeitura de destino.
drop policy if exists "materiais_select" on public.materiais;
create policy "materiais_select" on public.materiais
  for select using (auth.uid() is not null);
