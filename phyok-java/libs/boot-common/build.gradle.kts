plugins {
    `java-library`
}

dependencies {
    api(project(":libs:contracts"))
    api("org.springframework.boot:spring-boot-starter-web")
}
