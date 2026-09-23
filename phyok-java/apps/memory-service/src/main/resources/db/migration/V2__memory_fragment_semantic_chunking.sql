alter table memory_fragment
    add column if not exists fragment_type varchar(32) not null default 'EVENT',
    add column if not exists visibility varchar(32) not null default 'PRIVATE',
    add column if not exists time_bucket varchar(32) not null default 'today',
    add column if not exists topic_tags text not null default '',
    add column if not exists emotion_tags text not null default '',
    add column if not exists chunk_seq integer not null default 1,
    add column if not exists chunk_confidence numeric(5, 4) not null default 0.5000,
    add column if not exists chunk_strategy varchar(32) not null default 'LOCAL_FALLBACK';

create index if not exists idx_memory_fragment_semantic_filters
    on memory_fragment (tenant_id, app_id, user_id, timeline_root, fragment_type, deleted, searchable, created_at desc);

create index if not exists idx_memory_fragment_time_bucket
    on memory_fragment (tenant_id, app_id, user_id, time_bucket, deleted, searchable, created_at desc);
