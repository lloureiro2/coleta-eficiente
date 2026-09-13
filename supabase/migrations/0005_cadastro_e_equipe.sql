-- =============================================================
-- Cadastro só para cidadão/cooperativa e vínculo pela prefeitura.
-- - Prefeituras são criadas apenas pelo admin.
-- - O cidadão nasce SEM vínculo; a prefeitura o vincula e pode promovê-lo a gestor.
-- Execute DEPOIS do 0004_roteamento_prefeitura.sql.
-- =============================================================

-- Cidadão pode existir sem contratante até a prefeitura vinculá-lo.
alter table public.profiles alter column municipio_id drop not null;

-- O gatilho de cadastro passa a aceitar município nulo (cidadão sem vínculo).
create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, municipio_id, nome, email, telefone, endereco, bairro)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'municipio_id', '')::uuid,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.email,
    new.raw_user_meta_data ->> 'telefone',
    new.raw_user_meta_data ->> 'endereco',
    new.raw_user_meta_data ->> 'bairro'
  );
  return new;
end;
$$;

-- ---------- Equipe da prefeitura ----------
-- O gestor enxerga os perfis do seu contratante e também os "sem vínculo"
-- (para conseguir localizá-los e vinculá-los à prefeitura).
drop policy if exists "profiles_select_gestor_equipe" on public.profiles;
create policy "profiles_select_gestor_equipe" on public.profiles
  for select using (
    public.sou_gestor()
    and (municipio_id = public.meu_municipio() or municipio_id is null)
  );

-- O gestor vincula/promove: pode atualizar perfis do seu contratante ou sem
-- vínculo, sempre deixando-os no SEU contratante e como cidadão ou gestor.
drop policy if exists "profiles_update_gestor_equipe" on public.profiles;
create policy "profiles_update_gestor_equipe" on public.profiles
  for update using (
    public.sou_gestor()
    and (municipio_id = public.meu_municipio() or municipio_id is null)
  )
  with check (
    public.sou_gestor()
    and municipio_id = public.meu_municipio()
    and papel in ('cidadao', 'gestor')
  );
