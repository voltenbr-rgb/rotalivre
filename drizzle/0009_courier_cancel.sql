ALTER TABLE couriers ADD COLUMN cancel_count integer NOT NULL DEFAULT 0;
CREATE TABLE order_cancellations (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  order_id integer NOT NULL,
  courier_id integer NOT NULL,
  store_id integer,
  reason text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'accepted',
  created_at integer NOT NULL
);
CREATE INDEX order_cancellations_courier_idx ON order_cancellations (courier_id, created_at);
