plugins {
    `java-library`
}

dependencies {
    api(project(":libs:web-common"))
    api("org.springframework.kafka:spring-kafka")
}
