plugins {
    `java-library`
}

dependencies {
    api(project(":libs:web-common"))
    api("org.springframework.boot:spring-boot-starter-data-redis")
}
