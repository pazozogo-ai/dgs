create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  telegram_user_id text unique not null,
  display_name text,
  slug text unique not null,
  timezone text not null default 'Europe/Amsterdam',
  slot_minutes int not null default 30,
  day_start int not null default 10,
  day_end int not null default 18,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.login_nonces (
  nonce text primary key,
  status text not null default 'created',
  telegram_user_id text,
  user_id uuid references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.login_tokens (
  token text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_user_id text not null,
  status text not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create type public.booking_status as enum ('pending', 'approved', 'rejected');

create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  owner_telegram_user_id text not null,
  client_user_id uuid not null references public.users(id) on delete cascade,
  client_telegram_user_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  client_name text not null,
  client_comment text,
  status public.booking_status not null default 'pending',
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists bookings_owner_start_end_unique
on public.bookings(owner_user_id, start_at, end_at);

alter table public.users disable row level security;
alter table public.login_nonces disable row level security;
alter table public.login_tokens disable row level security;
alter table public.bookings disable row level security;
