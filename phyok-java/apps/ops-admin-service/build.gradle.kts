plugins {
    id("org.springframework.boot")
}

dependencies {
    implementation(project(":libs:contracts"))
    implementation(project(":libs:boot-common"))
    implementation(project(":libs:web-common"))
    implementation(project(":libs:security-common"))
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
