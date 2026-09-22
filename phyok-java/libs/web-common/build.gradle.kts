plugins {
    `java-library`
}

dependencies {
    api(project(":libs:boot-common"))
    api("org.springframework.boot:spring-boot-starter-web")
}
