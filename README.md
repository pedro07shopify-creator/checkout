# Cooud + Shopify — checkout próprio

Checkout próprio (fora do checkout nativo da Shopify) que processa pagamento com a
[Cooud](https://docs.cooud.com/public-doc) (API v2, Hosted Checkout) e mantém a loja
Shopify como fonte de verdade de preço/estoque/pedidos.

## Por que não é o "Painel" antigo

Este projeto substitui um checkout anterior que coletava número de cartão, validade e
CVV em campos de texto simples e os enviava para um backend próprio — isso é
inseguro (fora de escopo PCI) e viola diretamente as regras da própria Cooud
("never send raw PAN/CVV to Cooud or to the merchant backend"). Aqui, o cartão nunca
toca este projeto: quem coleta e processa é a própria página de pagamento hospedada
pela Cooud.

## Como funciona

```
Shopify (storefront)
  │  shopify-theme/checkout-interceptor.js intercepta "Comprar agora" / "Finalizar compra"
  ▼
POST /api/cart-sessions (server/)
  │  re-busca preço/estoque REAIS na Shopify Admin API (nunca confia no preço do navegador)
  │  cria a Checkout Session na Cooud
  ▼
redirect → checkout.cooud.com/...  (página de pagamento hospedada pela Cooud)
  │  cartão nunca passa pelo seu backend, nunca passa pelo seu domínio
  ▼
Cooud processa o pagamento
  │
  ▼
POST /api/webhooks/cooud  (order.paid, assinatura HMAC verificada)
  │  cria o pedido de verdade na Shopify (Admin API, financialStatus: PAID)
  ▼
Pedido aparece na Shopify com status pago
```

### Sobre endereço de entrega

O Hosted Checkout da Cooud pede um endereço na tela de pagamento, mas é só pra
verificação do cartão (billing/AVS) — esse dado fica com a Cooud e não é exposto de
volta pra este projeto via API/webhook. Os pedidos criados na Shopify por aqui
**não têm endereço de entrega**; para produtos físicos, hoje o endereço precisa ser
combinado com o comprador por fora (WhatsApp, e-mail etc.) depois da compra.

## Estrutura

- `server/` — backend Node/Express. Único lugar que guarda a `COOUD_SECRET_KEY` e o
  `SHOPIFY_ADMIN_ACCESS_TOKEN`. Nunca expostos ao navegador.
- `shopify-theme/checkout-interceptor.js` — snippet a instalar no tema Shopify para
  redirecionar o comprador pro checkout da Cooud em vez do checkout nativo.
- `docs/SETUP.md` — passo a passo de configuração (Cooud, Shopify, envs, deploy).
- `docs/GO_LIVE_CHECKLIST.md` — o que verificar antes de trocar sandbox por live.

## Rodando localmente

```bash
cd server
cp .env.example .env   # preencha com sua chave sandbox da Cooud + token da Shopify
npm install
npm run dev             # http://localhost:3010
```

Veja [docs/SETUP.md](docs/SETUP.md) para os passos de configuração da Cooud e da Shopify.

## Segurança — regras que este projeto segue

- Card data nunca toca este projeto: é coletado direto na página hospedada pela Cooud.
- `cooud_sk_*` só existe em `server/.env`, nunca em código de navegador.
- Todo preço é recalculado a partir da Shopify Admin API no backend — o navegador
  manda só `variantId` + `quantity`, nunca um valor.
- Webhook: assinatura `X-Cooud-Signature` verificada com HMAC-SHA256 sobre o raw body,
  com tolerância de 5 min contra replay, antes de qualquer processamento.
- Idempotência: eventos de webhook deduplicados por `event.id`; sessões de carrinho
  não são reprocessadas duas vezes.
