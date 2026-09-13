-- Prefeitura de Vitória (ES) e cooperativa local, com materiais e agenda inicial.

insert into public.municipios (id, nome, cidade, uf, tipo) values
  ('33333333-3333-3333-3333-333333333333', 'Prefeitura de Vitória', 'Vitória', 'ES', 'prefeitura'),
  ('44444444-4444-4444-4444-444444444444', 'Cooperativa Recicla Vitória', 'Vitória', 'ES', 'cooperativa');

-- Materiais da Prefeitura de Vitória.
insert into public.materiais (id, municipio_id, nome, icone, cor) values
  ('bbbb3333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Plástico', '🧴', '#2563EB'),
  ('bbbb3333-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Papelão', '📦', '#B45309'),
  ('bbbb3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Alumínio', '🥫', '#6B7280'),
  ('bbbb3333-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'Vidro', '🍾', '#059669'),
  ('bbbb3333-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'Eletrônicos', '🔌', '#7C3AED'),
  ('bbbb3333-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'Óleo de cozinha', '🛢️', '#D97706');

select public.popular_materiais_padrao('33333333-3333-3333-3333-333333333333');
select public.popular_materiais_padrao('44444444-4444-4444-4444-444444444444');

-- Agenda inicial da Prefeitura de Vitória (bairro nulo = cidade toda).
insert into public.agenda_coletas (municipio_id, material_id, dia_semana, bairro) values
  ('33333333-3333-3333-3333-333333333333', 'bbbb3333-0000-0000-0000-000000000001', 1, 'Jardim da Penha'),
  ('33333333-3333-3333-3333-333333333333', 'bbbb3333-0000-0000-0000-000000000002', 1, 'Jardim da Penha'),
  ('33333333-3333-3333-3333-333333333333', 'bbbb3333-0000-0000-0000-000000000001', 3, 'Praia do Canto'),
  ('33333333-3333-3333-3333-333333333333', 'bbbb3333-0000-0000-0000-000000000004', 3, null),
  ('33333333-3333-3333-3333-333333333333', 'bbbb3333-0000-0000-0000-000000000003', 5, null),
  ('33333333-3333-3333-3333-333333333333', 'bbbb3333-0000-0000-0000-000000000006', 6, 'Centro');
