# Checklist antes de trocar sandbox por live

- [ ] Fluxo completo testado em sandbox: produto → checkout → cartão de teste →
      webhook `order.paid` → pedido pago criado na Shopify.
- [ ] Testado também o caminho de erro: cartão recusado em sandbox não deve criar
      pedido na Shopify.
- [ ] `COOUD_SECRET_KEY` trocada de `cooud_sk_sandbox_*` para `cooud_sk_live_*`
      (gerada em Store → Integrations → Chaves da API v2 → Criar chave live).
- [ ] Novo webhook endpoint criado no Dashboard apontando para o backend de
      produção, com o `webhook_secret` de produção em `COOUD_WEBHOOK_SECRET`.
- [ ] `COOUD_SUCCESS_URL`, `COOUD_CANCEL_URL`, `CHECKOUT_PUBLIC_URL`,
      `ALLOWED_ORIGINS` apontando para os domínios reais.
- [ ] `server/data.json` em volume persistente (não efêmero) no host escolhido —
      perder esse arquivo perde o mapeamento carrinho → pedido em andamento. Para
      múltiplas instâncias do backend rodando ao mesmo tempo, troque
      `server/src/lib/store.js` por um banco de verdade (Postgres/Redis).
- [ ] Token Admin da Shopify (`shpat_*`) com escopo mínimo (`read_products`,
      `write_orders`), nunca commitado no repositório.
- [ ] Snippet do tema (`checkout-interceptor.js`) publicado e testado na loja real,
      não só num tema de rascunho.
- [ ] Confirmar com a Cooud a taxa/prazo de repasse (payouts) para ARS antes do
      primeiro dia de vendas reais.
