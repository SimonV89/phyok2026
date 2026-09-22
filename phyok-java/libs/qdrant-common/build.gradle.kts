plugins {
    `java-library`
}

dependencies {
    api(project(":libs:web-common"))
    api("com.fasterxml.jackson.core:jackson-databind")
}
