# Setup

## 1. Cooud

1. Entre no Dashboard Cooud da sua loja.
2. **Store → Integrations → Chaves da API v2 → Criar chave sandbox**. Copie o valor
   `cooud_sk_sandbox_...` — ele só aparece uma vez. Cole em `server/.env` como
   `COOUD_SECRET_KEY`.
3. **Store → Integrations → Webhooks → criar endpoint**:
   - URL: `https://SEU-BACKEND/api/webhooks/cooud` (em dev, use um túnel como `ngrok http 3010`)
   - Evento: `order.paid` (e opcionalmente `order.refunded`)
   - Copie o `webhook_secret` (`whsec_...`) exibido na criação e cole em
     `COOUD_WEBHOOK_SECRET`. Não é exibido de novo — se perder, crie um novo endpoint.
4. Cartões de teste (sandbox): veja `docs.cooud.com/public-doc/get-started/sandbox`.

## 2. Shopify (meli-respuestas.com)

1. Shopify Admin → **Configurações → Apps e canais de vendas → Desenvolver apps →
   Criar um app**.
2. Configure o escopo Admin API:
   - `read_products` (ler variantes e preços)
   - `write_orders` (criar o pedido depois do pagamento aprovado)
3. Instale o app na loja e copie o **Admin API access token** (`shpat_...`).
   Cole em `server/.env` como `SHOPIFY_ADMIN_ACCESS_TOKEN`.
4. `SHOPIFY_SHOP_DOMAIN=meli-respuestas.com`.

## 3. Instalar o snippet no tema

1. Suba `shopify-theme/checkout-interceptor.js` em **Online Store → Themes → Edit
   code → Assets → Add a new asset**.
2. Em `layout/theme.liquid`, antes de `</body>`:
   ```liquid
   <script src="{{ 'checkout-interceptor.js' | asset_url }}" defer
           data-checkout-api="https://SEU-BACKEND-DOMAIN"></script>
   ```
3. Publique o tema numa loja de teste antes de ir para a loja principal — teste o
   fluxo completo (produto → "Comprar agora" → checkout Cooud → pagamento sandbox →
   pedido aparecendo na Shopify).

## 4. Variáveis de ambiente

Veja `server/.env.example` e `web/.env.example`. Nenhuma chave secreta (`cooud_sk_*`,
`shpat_*`) deve existir em `web/`.

## 5. Deploy

- `server/`: qualquer host Node (Railway, Render, Fly.io, VPS). Exponha
  `/api/webhooks/cooud` publicamente com HTTPS — a Cooud precisa alcançá-lo.
- `web/`: `npm run build` gera `dist/`; hospede em qualquer static host (Vercel,
  Netlify, Cloudflare Pages). Configure fallback de SPA para `/pay/*`, `/success`,
  `/cancel` apontarem para `index.html`.
- Atualize `CHECKOUT_PUBLIC_URL`, `COOUD_SUCCESS_URL`, `COOUD_CANCEL_URL` e
  `ALLOWED_ORIGINS` em `server/.env` para os domínios reais de produção.
