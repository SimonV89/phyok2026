create table if not exists privacy_delete_job (
    job_id varchar(64) primary key,
    tenant_id varchar(64) not null,
    app_id varchar(64) not null,
    user_id varchar(64) not null,
    scope varchar(64) not null,
    status varchar(32) not null,
    requested_by varchar(64) not null,
    reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_privacy_delete_job_scope_created
    on privacy_delete_job (tenant_id, app_id, user_id, created_at desc, job_id desc);

create index if not exists idx_privacy_delete_job_status
    on privacy_delete_job (tenant_id, app_id, status, created_at desc);

insert into privacy_delete_job (
    job_id, tenant_id, app_id, user_id, scope, status, requested_by, reason, created_at, updated_at
) values (
    'erase_demo_001',
    'tenant-demo',
    'app-self-explore',
    'user-demo',
    'USER_FULL_ERASURE',
    'QUEUED',
    'user-demo',
    '用户主动请求清理全部隐私数据',
    now() - interval '3 hour',
    now() - interval '3 hour'
)
on conflict (job_id) do nothing;
