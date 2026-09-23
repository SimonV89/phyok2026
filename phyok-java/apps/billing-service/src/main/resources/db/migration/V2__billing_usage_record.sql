create table if not exists billing_usage_record (
    id varchar(64) primary key,
    app_id varchar(64) not null,
    user_email varchar(256) not null,
    run_id varchar(96) not null,
    scene varchar(64) not null default 'chat.success',
    quota_cost integer not null default 1,
    created_at timestamptz not null default now()
);

create unique index if not exists uk_billing_usage_app_user_run
    on billing_usage_record (app_id, user_email, run_id);
