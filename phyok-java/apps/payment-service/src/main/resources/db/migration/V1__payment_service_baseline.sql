create table if not exists payment_order (
    id varchar(64) primary key,
    app_id varchar(64) not null,
    user_email varchar(256) not null,
    plan_id varchar(32) not null,
    subject varchar(256) not null,
    amount_fen integer not null,
    quota integer not null,
    status varchar(32) not null default 'CREATED',
    pay_url text,
    qr_code_url text,
    trade_no varchar(128),
    buyer_id varchar(128),
    notify_payload text,
    expires_at timestamptz not null,
    paid_at timestamptz,
    version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_payment_order_user_email
    on payment_order (app_id, user_email, created_at desc);

create index if not exists idx_payment_order_status
    on payment_order (status, expires_at);

create unique index if not exists uk_payment_order_trade_no
    on payment_order (trade_no) where trade_no is not null;

create table if not exists payment_notify_log (
    id varchar(64) primary key,
    order_id varchar(64) not null,
    notify_id varchar(128),
    trade_no varchar(128),
    trade_status varchar(64),
    request_body_hash varchar(128) not null,
    processed boolean not null default false,
    payload_json text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists uk_payment_notify_log_notify_id
    on payment_notify_log (notify_id) where notify_id is not null;

create unique index if not exists uk_payment_notify_log_request_body_hash
    on payment_notify_log (request_body_hash);

create index if not exists idx_payment_notify_log_order_id
    on payment_notify_log (order_id, created_at desc);
