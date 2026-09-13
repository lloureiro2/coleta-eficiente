-- Cooperativa aprova ou recusa o agendamento. Só use o valor novo na próxima migration.
alter type public.status_solicitacao add value if not exists 'confirmada';
