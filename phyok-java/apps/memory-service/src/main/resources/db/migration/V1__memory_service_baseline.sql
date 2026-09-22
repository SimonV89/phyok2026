create table if not exists memory_fragment (
    id varchar(64) primary key,
    tenant_id varchar(64) not null,
    app_id varchar(64) not null,
    user_id varchar(64) not null,
    timeline_root varchar(32) not null,
    content_text text not null,
    searchable boolean not null default true,
    deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_memory_fragment_scope_search
    on memory_fragment (tenant_id, app_id, user_id, deleted, searchable, created_at desc, id desc);

create index if not exists idx_memory_fragment_scope_timeline
    on memory_fragment (tenant_id, app_id, user_id, timeline_root, deleted, searchable, created_at desc);

insert into memory_fragment (
    id, tenant_id, app_id, user_id, timeline_root, content_text, searchable, deleted, created_at, updated_at
) values
    (
        'mem_demo_001',
        'tenant-demo',
        'app-self-explore',
        'user-demo',
        'CHILDHOOD',
        '小时候父母争吵后，家里会突然安静下来，我总会提前观察空气里的变化，担心关系马上断掉。',
        true,
        false,
        now() - interval '10 day',
        now() - interval '10 day'
    ),
    (
        'mem_demo_002',
        'tenant-demo',
        'app-self-explore',
        'user-demo',
        'STUDENT',
        '学生时代我在亲密关系里经常先做最坏打算，哪怕对方没有离开的迹象，也会提前做好失去的心理准备。',
        true,
        false,
        now() - interval '5 day',
        now() - interval '5 day'
    ),
    (
        'mem_demo_003',
        'tenant-demo',
        'app-self-explore',
        'user-demo',
        'WORK',
        '工作以后遇到重要关系时，我会一边靠近一边后退，怕自己太投入之后会再次经历突然失联。',
        true,
        false,
        now() - interval '2 day',
        now() - interval '2 day'
    )
on conflict (id) do nothing;
