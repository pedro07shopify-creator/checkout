# Cooud + Shopify — checkout próprio

Checkout próprio (fora do checkout nativo da Shopify) que processa pagamento com a
[Cooud](https://docs.cooud.com/public-doc) (API v2, custom checkout via Cooud Elements) e
mantém a loja Shopify como fonte de verdade de preço/estoque/pedidos.

## Por que não é o "Painel" antigo

Este projeto substitui um checkout anterior que coletava número de cartão, validade e
CVV em campos de texto simples e os enviava para um backend próprio — isso é
inseguro (fora de escopo PCI) e viola diretamente as regras da própria Cooud
("never send raw PAN/CVV to Cooud or to the merchant backend"). Aqui, o cartão nunca
toca este backend: quem coleta e tokeniza é o `elements/v1.js` da Cooud, rodando num
contexto isolado que a Cooud controla.

## Como funciona

```
Shopify (storefront)
  │  shopify-theme/checkout-interceptor.js intercepta "Comprar agora" / "Finalizar compra"
  ▼
POST /api/cart-sessions (server/)
  │  re-busca preço/estoque REAIS na Shopify Admin API (nunca confia no preço do navegador)
  │  grava a sessão de carrinho em server/data.json
  ▼
redirect → web/ (React) em /pay/:cartSessionId
  │  POST /api/checkout-sessions        → cria a Checkout Session na Cooud (ui_mode: custom)
  │  POST /api/checkout-sessions/:id/element-config
  │  monta https://cdn.cooud.com/cdn/elements/v1.js  (cartão nunca passa por aqui)
  ▼
Cooud processa o pagamento
  │
  ▼
POST /api/webhooks/cooud  (order.paid, assinatura HMAC verificada)
  │  cria o pedido de verdade na Shopify (Admin API, financialStatus: PAID)
  ▼
Pedido aparece na Shopify com status pago
```

## Estrutura

- `server/` — backend Node/Express. Único lugar que guarda a `COOUD_SECRET_KEY` e o
  `SHOPIFY_ADMIN_ACCESS_TOKEN`. Nunca expostos ao navegador.
- `web/` — frontend React/Vite. Seu checkout. Monta o Cooud Element; não tem acesso a
  nenhuma chave secreta.
- `shopify-theme/checkout-interceptor.js` — snippet a instalar no tema Shopify para
  redirecionar o comprador para `web/` em vez do checkout nativo.
- `docs/SETUP.md` — passo a passo de configuração (Cooud, Shopify, envs, deploy).
- `docs/GO_LIVE_CHECKLIST.md` — o que verificar antes de trocar sandbox por live.

## Rodando localmente

```bash
# 1. backend
cd server
cp .env.example .env   # preencha com sua chave sandbox da Cooud + token da Shopify
npm install
npm run dev             # http://localhost:3010

# 2. frontend
cd ../web
cp .env.example .env
npm install
npm run dev             # http://localhost:5173
```

Veja [docs/SETUP.md](docs/SETUP.md) para os passos de configuração da Cooud e da Shopify.

## Segurança — regras que este projeto segue

- Card data nunca toca `server/` nem `web/`: só o iframe da Cooud (`elements/v1.js`).
- `cooud_sk_*` só existe em `server/.env`, nunca em código de navegador.
- Todo preço é recalculado a partir da Shopify Admin API no backend — o navegador
  manda só `variantId` + `quantity`, nunca um valor.
- Webhook: assinatura `X-Cooud-Signature` verificada com HMAC-SHA256 sobre o raw body,
  com tolerância de 5 min contra replay, antes de qualquer processamento.
- Idempotência: eventos de webhook deduplicados por `event.id`; sessões de carrinho
  não são reprocessadas duas vezes.
