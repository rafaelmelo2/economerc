-- migrate:up
-- Onda 2C criou carts/cart_items em paralelo à 2B (products/markets), sem FK.
-- Índices em market_id/product_id já existem (criados na 2C).
ALTER TABLE carts
    ADD CONSTRAINT fk_carts_market_id FOREIGN KEY (market_id) REFERENCES markets (id);
ALTER TABLE cart_items
    ADD CONSTRAINT fk_cart_items_product_id FOREIGN KEY (product_id) REFERENCES products (id);

-- migrate:down
ALTER TABLE cart_items DROP CONSTRAINT fk_cart_items_product_id;
ALTER TABLE carts DROP CONSTRAINT fk_carts_market_id;
