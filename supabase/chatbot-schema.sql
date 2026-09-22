-- Peak AI weboldali chatbot — beszélgetés-napló
-- Futtatás: Supabase Dashboard → SQL Editor (Peak AI org, Centrum Gumi
-- projekttől FÜGGETLEN, saját "peakai-web" Supabase-projektben, vagy
-- amit Barni kijelöl a SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env
-- változókban a Vercel projektben).
--
-- A /api/chat.js szerverless function a service role key-jével ír bele
-- (server-to-server, soha nem a böngészőből), ezért az RLS bekapcsolva
-- marad, de nyilvános policy nincs hozzá — csak a service role fér hozzá.

create table if not exists chatbot_beszelgetesek (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  page        text,
  created_at  timestamptz not null default now()
);

create index if not exists chatbot_beszelgetesek_session_idx
  on chatbot_beszelgetesek (session_id, created_at);

create index if not exists chatbot_beszelgetesek_created_idx
  on chatbot_beszelgetesek (created_at desc);

alter table chatbot_beszelgetesek enable row level security;
-- Nincs public/anon policy — az API csak a service role key-jével ír,
-- ami RLS-t megkerüli. Olvasáshoz a Supabase Dashboard SQL Editorát
-- (service role) vagy egy külön, belső dashboard-kulcsot használj.
