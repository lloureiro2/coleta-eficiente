-- Novos status: a prefeitura aprova ou recusa; a cooperativa só vê as aprovadas.
-- Execute sozinho (o Postgres não deixa usar um valor novo de enum na mesma transação).

alter type public.status_solicitacao add value if not exists 'aprovada';
alter type public.status_solicitacao add value if not exists 'recusada';
