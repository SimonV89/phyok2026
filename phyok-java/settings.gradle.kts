pluginManagement {
    repositories {
        maven(url = "https://maven.aliyun.com/repository/gradle-plugin")
        maven(url = "https://maven.aliyun.com/repository/public")
        maven(url = "https://mirrors.cloud.tencent.com/nexus/repository/maven-public/")
        maven(url = "https://repo.huaweicloud.com/repository/maven/")
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        maven(url = "https://mirrors.cloud.tencent.com/nexus/repository/maven-public/")
        maven(url = "https://maven.aliyun.com/repository/public")
        maven(url = "https://repo.huaweicloud.com/repository/maven/")
        mavenCentral()
    }
}

rootProject.name = "phyok-java"

include(
    "apps:auth-service",
    "apps:tenant-service",
    "apps:memory-service",
    "apps:memory-embedding-consumer",
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
