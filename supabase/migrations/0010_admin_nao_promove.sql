-- Admin consulta usuários, mas não altera papel. Gestor é promovido pela prefeitura.

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.sou_admin() and id = auth.uid())
  with check (public.sou_admin() and id = auth.uid() and papel = 'admin');
