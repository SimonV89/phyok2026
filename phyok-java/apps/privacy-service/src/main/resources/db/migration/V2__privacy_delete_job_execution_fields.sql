alter table if exists privacy_delete_job
    add column if not exists affected_count integer not null default 0;
