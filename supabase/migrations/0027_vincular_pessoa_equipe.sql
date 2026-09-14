-- Vincular pessoa à Equipe falhava em silêncio: a policy de UPDATE aceita
-- municipio_id nulo, mas nenhuma policy de SELECT mostra quem está sem vínculo,
-- e o UPDATE ... where id = ? não enxerga a linha (0 linhas, sem erro).
-- Sem vínculo, a promoção a gestor também nunca gravava.

create or replace function public.vincular_pessoa_equipe(p_pessoa_id uuid)
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
    raise exception 'Só a prefeitura ou a cooperativa pode vincular pessoas à equipe.';
  end if;
  if meu_contratante is null then
    raise exception 'Sua conta não está vinculada a uma prefeitura ou cooperativa.';
  end if;

  select * into pessoa from public.profiles where id = p_pessoa_id;
  if pessoa.id is null then
    raise exception 'Pessoa não encontrada.';
  end if;
  if pessoa.papel = 'admin' or coalesce(pessoa.conta_institucional, false) then
    raise exception 'Esta conta não pode ser vinculada a uma equipe.';
  end if;
  if pessoa.municipio_id is not null and pessoa.municipio_id <> meu_contratante then
    raise exception 'Esta pessoa já está vinculada a outro contratante.';
  end if;

  update public.profiles
  set municipio_id = meu_contratante
  where id = p_pessoa_id
  returning * into pessoa;

  return pessoa;
end;
$func$;

grant execute on function public.vincular_pessoa_equipe(uuid) to authenticated;
