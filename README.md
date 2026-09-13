# Coleta Eficiente

Aplicativo de coleta seletiva porta a porta, vendido para **prefeituras** e **cooperativas**:

- **Cidadão / cidadã** (iOS, Android e Web): solicita coleta porta a porta com CEP, geolocalização e foto, e acompanha cada etapa (hora, quem fez, onde) com notificação no celular.
- **Contratante** (prefeitura ou cooperativa, mesma tela): vê o processo inteiro, aprova ou recusa, encaminha por demanda, despacha o caminhão, registra a coleta com foto e acompanha o resumo.
- **Admin**: cadastra prefeituras e cooperativas (conta institucional de e-mail + senha). Quem coleta no campo é pessoa promovida na Equipe.

Feito com [Expo](https://expo.dev) SDK 57 (React Native) e [Supabase](https://supabase.com).

## Como rodar

### 1. Configurar o Supabase (uma vez só)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No painel do projeto, abra **SQL Editor** e execute, nesta ordem:
   - o conteúdo de cada arquivo em [`supabase/migrations/`](supabase/migrations/) (do `0001` ao `0023`);
   - opcionalmente [`supabase/seed.sql`](supabase/seed.sql) para dados de exemplo.
3. Em **Settings > API**, copie a **Project URL** e a **anon public key**.
4. Copie `.env.example` para `.env` e preencha com esses dois valores.

> Dica: em **Authentication > Providers > Email**, você pode desativar "Confirm email" durante os testes para entrar direto após o cadastro.

O envio de push usa a extensão `pg_net` (já habilitada na migration `0023`) para a API da Expo. A função [`supabase/functions/notificar-status`](supabase/functions/notificar-status) é um caminho extra: só configure um Database Webhook nela se desativar o `enviar_push_solicitacao` no trigger, senão o cidadão recebe o aviso duas vezes.

No Android, push remoto **não funciona no Expo Go** (desde o SDK 53). Use um [development build](https://docs.expo.dev/develop/development-builds/introduction/).

### 2. Instalar e iniciar

```bash
npm install
npm run web      # abre o site no navegador
npm start        # abre o Expo; escaneie o QR code com o app Expo Go no celular
```

### 3. Criar o administrador da plataforma (uma vez só)

1. Cadastre-se pelo app normalmente com o seu e-mail.
2. No SQL Editor do Supabase, rode:

```sql
update public.profiles
  set papel = 'admin'
  where id = (select id from auth.users where email = 'SEU-EMAIL');
```

3. Saia e entre de novo: no painel do admin você cria prefeituras e cooperativas. A promoção de gestores é na Equipe de cada contratante.

O cadastro público é só para cidadão/cidadã (gênero, telefone com DDD, CEP e número obrigatórios).

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `src/app/(auth)` | Login e cadastro de cidadão/cidadã |
| `src/app/(cidadao)` | Solicitar coleta, meus pedidos (linha do tempo) e perfil |
| `src/app/(gestor)` | Solicitações, rota, equipe, resumo e registro da coleta |
| `src/components` | UI, mapa e linha do tempo |
| `src/lib` | Supabase, autenticação, tipos e utilitários |
| `supabase/` | Migrações SQL, função de push e dados de exemplo |

## Segurança (multi-tenant)

Todas as tabelas usam Row Level Security do PostgreSQL:

- cada cidadão/cidadã vê apenas as próprias solicitações;
- prefeitura vê as solicitações da sua cidade;
- cooperativa vê as da própria cidade e as que a prefeitura encaminhou a ela;
- o papel de gestor de uma pessoa é concedido na Equipe, não no cadastro público.
