CREATE TABLE location_requests (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  token text NOT NULL,
  store_id integer NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  lat real,
  lng real,
  accuracy real,
  address text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  created_at integer NOT NULL,
  received_at integer
);
CREATE UNIQUE INDEX location_requests_token_idx ON location_requests (token);
CREATE INDEX location_requests_store_idx ON location_requests (store_id, created_at);
