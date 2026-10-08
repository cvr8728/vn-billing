-- Run once in Supabase > SQL Editor (safe to re-run)
create extension if not exists pgcrypto;
create table if not exists users(id uuid primary key default gen_random_uuid(), email text unique not null, name text not null, password_hash text, role text not null default 'user', discord_id text unique, google_id text unique, created_at timestamptz default now());
create table if not exists services(id bigserial primary key, user_id uuid references users(id) on delete cascade, name text not null, type text not null, panel text not null default 'none', vmid int, status text not null default 'running', spec text, price numeric(8,2) default 0, created_at timestamptz default now());
alter table services add column if not exists meta jsonb; -- delivered details: {"ip":"","username":"","password":""}
create table if not exists orders(id text primary key, user_id uuid references users(id) on delete cascade, items jsonb, total numeric(10,2), gateway text, status text default 'pending', created_at timestamptz default now());
create table if not exists tickets(id bigserial primary key, user_id uuid references users(id) on delete cascade, subject text, message text, status text default 'open', created_at timestamptz default now());
alter table users enable row level security; alter table services enable row level security; alter table orders enable row level security; alter table tickets enable row level security; -- no policies: server key only
