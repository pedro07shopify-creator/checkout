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
4. `SHOPIFY_SHOP_DOMAIN` precisa ser o domínio **`.myshopify.com`**, não o domínio
   customizado da loja — a Admin API não responde em `meli-respuestas.com`. Para achar
   o domínio certo: Shopify Admin → Configurações → Domínios (aparece como "domínio
   principal da Shopify"), ou rode `shop { myshopifyDomain }` via GraphQL Admin API.

## 3. Instalar o snippet no tema

1. Suba `shopify-theme/checkout-interceptor.js` em **Online Store → Themes → Edit
   code → Assets → Add a new asset**.
2. Em `layout/theme.liquid`, antes de `</body>` (repare que temas com uma seção
   `{% else %}` de "tema desativado" têm dois `</body>` — use o primeiro, da branch
   real do tema):
   ```liquid
   <script src="{{ 'checkout-interceptor.js' | asset_url }}" defer
           data-checkout-api="https://SEU-BACKEND-DOMAIN"></script>
   ```
3. **Desative os botões de checkout dinâmico** ("Comprar agora" / "Buy it now") nas
   configurações de produto do tema (Personalizar → bloco de Comprar/Preço → "Mostrar
   botões de checkout dinâmico"). Esse botão roda dentro de um iframe da própria
   Shopify — nenhum script de tema consegue interceptar o clique nele. Deixe só
   "Adicionar ao carrinho"; o botão "Finalizar compra" do carrinho não é iframe e
   funciona normalmente com o snippet.
4. Publique o tema numa loja de teste antes de ir para a loja principal — teste o
   fluxo completo (produto → Adicionar ao carrinho → Finalizar compra → checkout Cooud
   → pagamento sandbox → pedido aparecendo na Shopify).

## 4. Variáveis de ambiente

Veja `server/.env.example`.

## 5. Deploy

- `server/`: qualquer host Node (Railway, Render, Fly.io, VPS) com HTTPS. Exponha
  publicamente `/api/webhooks/cooud` — a Cooud precisa alcançá-lo.
- Atualize `COOUD_SUCCESS_URL` e `COOUD_CANCEL_URL` — o ideal é apontarem para páginas
  reais da sua loja Shopify (ex: uma página "Obrigado pela compra" e o carrinho),
  não para o backend.
- Atualize `ALLOWED_ORIGINS` para o domínio real da sua loja Shopify (é de lá que o
  snippet do tema chama `POST /api/cart-sessions`).
