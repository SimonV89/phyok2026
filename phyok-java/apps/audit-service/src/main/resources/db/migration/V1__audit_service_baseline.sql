create table if not exists audit_event (
    id varchar(64) primary key,
    tenant_id varchar(64) not null,
    app_id varchar(64) not null,
    user_id varchar(64),
    trace_id varchar(128) not null,
    request_id varchar(128) not null,
    event_type varchar(64) not null,
    source_service varchar(64) not null,
    entity_type varchar(64),
    entity_id varchar(64),
    payload_json text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_event_scope_created
    on audit_event (tenant_id, app_id, user_id, created_at desc, id desc);

create index if not exists idx_audit_event_event_type
    on audit_event (tenant_id, app_id, event_type, created_at desc);

create index if not exists idx_audit_event_entity
    on audit_event (tenant_id, app_id, entity_type, entity_id, created_at desc);

insert into audit_event (
    id, tenant_id, app_id, user_id, trace_id, request_id, event_type, source_service, entity_type, entity_id, payload_json, created_at
) values (
    'audit_demo_001',
    'tenant-demo',
    'app-self-explore',
    'user-demo',
    'trace-demo-001',
    'req-audit-demo-001',
    'MEMORY_CREATED',
    'memory-service',
    'MEMORY_FRAGMENT',
    'mem_demo_001',
    '{"summary":"demo memory fragment created"}',
    now() - interval '1 day'
)
on conflict (id) do nothing;
