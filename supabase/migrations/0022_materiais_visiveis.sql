-- Garante os 20 materiais e troca ícones que somem em alguns aparelhos
-- (pneu 🛞 e isopor ◻️).

create or replace function public.popular_materiais_padrao(p_municipio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.materiais (municipio_id, nome, icone, cor)
  select p_municipio_id, v.nome, v.icone, v.cor
  from (
    values
      ('Plástico', '🧴', '#2563EB'),
      ('PET', '🥤', '#0284C7'),
      ('Papel', '📄', '#CA8A04'),
      ('Papelão', '📦', '#B45309'),
      ('Alumínio', '🥫', '#6B7280'),
      ('Metal', '⚙️', '#4B5563'),
      ('Vidro', '🍾', '#059669'),
      ('Embalagem longa vida', '🧃', '#65A30D'),
      ('Isopor', '🔳', '#78716C'),
      ('Eletrônicos', '🔌', '#7C3AED'),
      ('Pilhas e baterias', '🔋', '#DC2626'),
      ('Óleo de cozinha', '🛢️', '#D97706'),
      ('Lâmpadas', '💡', '#F59E0B'),
      ('Orgânico', '🍃', '#16A34A'),
      ('Madeira', '🪵', '#92400E'),
      ('Tecidos', '👕', '#DB2777'),
      ('Entulho', '🧱', '#A8A29E'),
      ('Pneus', '🚗', '#111827'),
      ('Móveis', '🪑', '#9A3412'),
      ('Podas e galhos', '🌿', '#15803D')
  ) as v(nome, icone, cor)
  where not exists (
    select 1
    from public.materiais m
    where m.municipio_id = p_municipio_id
      and lower(m.nome) = lower(v.nome)
  );

  update public.materiais m
  set icone = v.icone, cor = v.cor
  from (
    values
      ('Isopor', '🔳', '#78716C'),
      ('Pneus', '🚗', '#111827')
  ) as v(nome, icone, cor)
  where m.municipio_id = p_municipio_id
    and lower(m.nome) = lower(v.nome);
end;
$func$;

select public.popular_materiais_padrao(id) from public.municipios;
