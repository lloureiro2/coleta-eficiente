-- Novo papel "admin" (dono da plataforma).
-- IMPORTANTE: execute este arquivo sozinho, antes do 0003_admin.sql
-- (o Postgres não permite usar um valor novo de enum na mesma transação que o cria).

alter type public.papel_usuario add value if not exists 'admin';
