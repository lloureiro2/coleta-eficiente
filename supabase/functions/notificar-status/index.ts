import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

const MENSAGEM: Record<string, string> = {
  pendente: 'Sua solicitação de coleta foi registrada.',
  aprovada: 'Sua solicitação foi aprovada.',
  agendada: 'Sua coleta foi encaminhada para a equipe.',
  confirmada: 'A equipe confirmou a sua coleta.',
  caminhao_a_caminho: 'O caminhão está a caminho da sua coleta.',
  coletada: 'Sua coleta foi concluída.',
  recusada: 'Sua solicitação foi recusada.',
  cancelada: 'Sua solicitação foi cancelada.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const corpo = await req.json();
    const registro = corpo.record ?? corpo;
    const solicitacaoId = registro.solicitacao_id as string | undefined;
    const status = registro.status as string | undefined;
    if (!solicitacaoId || !status) {
      return json({ ok: false, erro: 'Payload sem solicitacao_id ou status.' }, 400);
    }

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(url, chave);

    const { data: solicitacao } = await supabase
      .from('solicitacoes')
      .select('cidadao_id')
      .eq('id', solicitacaoId)
      .maybeSingle();

    if (!solicitacao?.cidadao_id) {
      return json({ ok: true, enviados: 0 });
    }

    const { data: dispositivos } = await supabase
      .from('dispositivos_push')
      .select('expo_push_token')
      .eq('user_id', solicitacao.cidadao_id);

    const tokens = (dispositivos ?? []).map((d) => d.expo_push_token).filter(Boolean);
    if (tokens.length === 0) {
      return json({ ok: true, enviados: 0 });
    }

    const mensagens = tokens.map((to) => ({
      to,
      sound: 'default',
      title: 'Coleta Eficiente',
      body: MENSAGEM[status] ?? 'Sua solicitação foi atualizada.',
      data: { solicitacaoId, status },
    }));

    await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mensagens),
    });

    return json({ ok: true, enviados: tokens.length });
  } catch (erro) {
    return json({ ok: false, erro: erro instanceof Error ? erro.message : 'falha' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
