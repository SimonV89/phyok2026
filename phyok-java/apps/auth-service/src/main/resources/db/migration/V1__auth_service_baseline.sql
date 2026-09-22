create table if not exists user_account (
    id varchar(64) primary key,
    tenant_id varchar(64) not null,
    app_id varchar(64) not null,
    email varchar(256),
    mobile varchar(64),
    display_name varchar(128),
    status varchar(32) not null default 'ACTIVE',
    register_source varchar(32),
    last_login_at timestamptz,
    deleted boolean not null default false,
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uk_user_account_email
    on user_account (tenant_id, app_id, email) where email is not null;

create index if not exists idx_user_account_status
    on user_account (tenant_id, app_id, status);

create table if not exists user_session (
    id varchar(64) primary key,
    tenant_id varchar(64) not null,
    app_id varchar(64) not null,
    user_id varchar(64) not null,
    session_token_hash varchar(256) not null,
    refresh_token_hash varchar(256) not null,
    device_id varchar(128),
    client_version varchar(64),
    expired_at timestamptz not null,
    revoked boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_user_session_user_id
    on user_session (tenant_id, app_id, user_id, revoked, expired_at);

create index if not exists idx_user_session_expired_at
    on user_session (expired_at);

insert into user_account (
    id, tenant_id, app_id, email, display_name, status, register_source, deleted, version, created_at, updated_at
) values (
    'user-demo',
    'tenant-demo',
    'app-self-explore',
    'demo@phyok.com',
    'Demo User',
    'ACTIVE',
    'EMAIL',
    false,
    0,
    now(),
    now()
) on conflict (id) do nothing;

insert into user_session (
    id, tenant_id, app_id, user_id, session_token_hash, refresh_token_hash, device_id, client_version, expired_at, revoked, created_at
) values (
    'sess-demo',
    'tenant-demo',
    'app-self-explore',
    'user-demo',
    'demo-token',
    'demo-refresh-token',
    'device-demo',
    'web-0.1.0',
    now() + interval '30 day',
    false,
    now()
) on conflict (id) do nothing;
