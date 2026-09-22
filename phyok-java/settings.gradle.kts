rootProject.name = "phyok-java"

include(
    "apps:auth-service",
    "apps:tenant-service",
    "apps:memory-service",
    "apps:knowledge-service",
    "apps:billing-service",
    "apps:payment-service",
    "apps:audit-service",
    "apps:privacy-service",
    "apps:ops-admin-service",
    "libs:boot-common",
    "libs:web-common",
    "libs:security-common",
    "libs:mybatis-common",
    "libs:kafka-common",
    "libs:redis-common",
    "libs:postgres-common",
    "libs:qdrant-common",
    "libs:contracts"
)
