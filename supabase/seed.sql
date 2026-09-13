-- =============================================================
-- Coleta Eficiente - Dados de exemplo
-- Execute DEPOIS de 0001_init.sql no SQL Editor do Supabase.
-- =============================================================

-- Dois contratantes de demonstração.
insert into public.municipios (id, nome, cidade, uf, tipo) values
  ('11111111-1111-1111-1111-111111111111', 'Prefeitura de Cidade Modelo', 'Cidade Modelo', 'SP', 'prefeitura'),
  ('22222222-2222-2222-2222-222222222222', 'Cooperativa Recicla Vida', 'Vale Verde', 'MG', 'cooperativa');

-- Materiais aceitos pela Prefeitura de Cidade Modelo.
insert into public.materiais (id, municipio_id, nome, icone, cor) values
  ('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Plástico', '🧴', '#2563EB'),
  ('aaaa1111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Papelão', '📦', '#B45309'),
  ('aaaa1111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Alumínio', '🥫', '#6B7280'),
  ('aaaa1111-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Vidro', '🍾', '#059669'),
  ('aaaa1111-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Eletrônicos', '🔌', '#7C3AED'),
  ('aaaa1111-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Óleo de cozinha', '🛢️', '#D97706');

select public.popular_materiais_padrao('11111111-1111-1111-1111-111111111111');
select public.popular_materiais_padrao('22222222-2222-2222-2222-222222222222');

-- Agenda semanal da Prefeitura de Cidade Modelo (bairro nulo = cidade toda).
insert into public.agenda_coletas (municipio_id, material_id, dia_semana, bairro) values
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', 1, 'Centro'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000002', 1, 'Centro'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', 3, 'Jardim das Flores'),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000004', 3, null),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000003', 5, null),
  ('11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000006', 6, 'Centro');

-- =============================================================
-- Para criar um GESTOR de demonstração:
-- 1. Cadastre-se normalmente pelo app (ex.: gestor@demo.com),
--    escolhendo o município desejado.
-- 2. Rode o comando abaixo trocando o e-mail:
--
-- update public.profiles
--   set papel = 'gestor'
--   where id = (select id from auth.users where email = 'gestor@demo.com');
-- =============================================================
