-- =============================================================
-- Restringe a descoberta de cidadãos sem vínculo.
-- Antes o gestor via TODOS os cidadãos sem vínculo. Agora ele só encontra
-- um cidadão informando o e-mail exato (via função), preservando privacidade.
-- Execute DEPOIS do 0005_cadastro_e_equipe.sql.
-- =============================================================

-- O gestor volta a enxergar por SELECT apenas os perfis do próprio contratante.
drop policy if exists "profiles_select_gestor_equipe" on public.profiles;
create policy "profiles_select_gestor_equipe" on public.profiles
  for select using (
    public.sou_gestor() and municipio_id = public.meu_municipio()
  );

-- Busca controlada: retorna um cidadão SEM vínculo apenas por e-mail exato,
-- e somente se quem chama for gestor. (A policy de UPDATE continua permitindo
-- vincular perfis sem vínculo, então o gestor consegue efetivar o vínculo.)
create or replace function public.buscar_cidadao_sem_vinculo(p_email text)
returns table (id uuid, nome text, email text, telefone text)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.nome, p.email, p.telefone
  from public.profiles p
  where public.sou_gestor()
    and p.municipio_id is null
    and p.papel = 'cidadao'
    and lower(p.email) = lower(trim(p_email));
$$;
