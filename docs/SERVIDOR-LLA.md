# Servidor LLA — Coleta Eficiente

Este PC (`servidorlla.com.br`) hospeda o app via **Cloudflare Tunnel** (túnel próprio, separado dos outros apps).

| Item | Valor |
| --- | --- |
| URL pública | https://coleta.servidorlla.com.br |
| Porta local | **8081** |
| Repositório | https://github.com/lloureiro2/coleta-eficiente |
| Túnel | `cloudflared.yml` na raiz (tunnel `coleta-eficiente`) |

## Subir no servidor (Windows)

1. Copie `.env.example` → `.env` com URL e chave anon do Supabase.
2. Instale dependências (uma vez): `npm install`
3. **Terminal 1** — site:
   ```powershell
   npm run servidor:web
   ```
4. **Terminal 2** — túnel:
   ```powershell
   npm run tunel
   ```

## Após reiniciar o PC

Repita os passos 3 e 4 (ou configure tarefa agendada / serviço Windows).

## Desenvolvimento noutro PC

Clone o repo, configure `.env`, use `npm run web` ou `npm start` (Expo Go). O Supabase é na nuvem — não precisa deste servidor para programar.
