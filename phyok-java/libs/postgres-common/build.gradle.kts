plugins {
    `java-library`
}

dependencies {
    api(project(":libs:mybatis-common"))
    api("org.postgresql:postgresql")
    api("org.flywaydb:flyway-core")
}
