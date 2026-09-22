create table if not exists tenant (
    id varchar(64) primary key,
    tenant_code varchar(64) not null,
    tenant_name varchar(128) not null,
    status varchar(32) not null default 'ACTIVE',
    plan_code varchar(64),
    deleted boolean not null default false,
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uk_tenant_tenant_code on tenant (tenant_code);

create table if not exists app (
    id varchar(64) primary key,
    tenant_id varchar(64) not null,
    app_code varchar(64) not null,
    app_name varchar(128) not null,
    app_mode varchar(32) not null default 'CHAT',
    default_model_route varchar(128),
    status varchar(32) not null default 'ACTIVE',
    deleted boolean not null default false,
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uk_app_tenant_app_code on app (tenant_id, app_code);
create index if not exists idx_app_status on app (status);

insert into tenant (
    id, tenant_code, tenant_name, status, plan_code, deleted, version, created_at, updated_at
) values (
    'tenant-demo',
    'tenant_demo',
    'Tenant Demo',
    'ACTIVE',
    'pro',
    false,
    0,
    now(),
    now()
) on conflict (id) do nothing;

insert into app (
    id, tenant_id, app_code, app_name, app_mode, default_model_route, status, deleted, version, created_at, updated_at
) values (
    'app-self-explore',
    'tenant-demo',
    'self_explore',
    'Self Explore Agent Pro',
    'CHAT',
    'langgraph-node',
    'ACTIVE',
    false,
    0,
    now(),
    now()
) on conflict (id) do nothing;
