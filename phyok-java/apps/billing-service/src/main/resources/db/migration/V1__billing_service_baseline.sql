create table if not exists billing_account (
    id varchar(64) primary key,
    app_id varchar(64) not null,
    user_email varchar(256) not null,
    plan_id varchar(32) not null,
    base_quota integer not null default 0,
    purchased_quota integer not null default 0,
    consumed_quota integer not null default 0,
    seed_user boolean not null default false,
    status varchar(32) not null default 'ACTIVE',
    last_grant_order_no varchar(64),
    last_grant_at timestamptz,
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uk_billing_account_app_user
    on billing_account (app_id, user_email);

create table if not exists billing_grant_record (
    id varchar(64) primary key,
    order_no varchar(64) not null,
    app_id varchar(64) not null,
    user_email varchar(256) not null,
    plan_id varchar(32) not null,
    quota integer not null,
    amount_fen integer not null,
    payment_channel varchar(32) not null,
    status varchar(32) not null default 'GRANTED',
    created_at timestamptz not null default now()
);

create unique index if not exists uk_billing_grant_order_no
    on billing_grant_record (order_no);
