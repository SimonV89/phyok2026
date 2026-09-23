create table if not exists memory_projection_outbox (
    id varchar(64) primary key,
    tenant_id varchar(64) not null,
    app_id varchar(64) not null,
    user_id varchar(64) not null,
    fragment_id varchar(64) not null,
    event_type varchar(32) not null,
    topic_name varchar(128) not null,
    payload_json text not null,
    status varchar(32) not null default 'PENDING',
    attempt_count integer not null default 0,
    available_at timestamptz not null default now(),
    last_error text,
    processed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_memory_projection_outbox_pending
    on memory_projection_outbox (status, available_at, created_at);

create index if not exists idx_memory_projection_outbox_fragment
    on memory_projection_outbox (tenant_id, app_id, user_id, fragment_id, created_at desc);
