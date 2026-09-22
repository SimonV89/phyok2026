plugins {
    id("java")
    id("io.spring.dependency-management") version "1.1.6"
    id("org.springframework.boot") version "3.3.4" apply false
}

group = "com.phyok"
version = "0.1.0-SNAPSHOT"

allprojects {
    repositories {
        maven(url = "https://mirrors.cloud.tencent.com/nexus/repository/maven-public/")
        maven(url = "https://maven.aliyun.com/repository/public")
        maven(url = "https://repo.huaweicloud.com/repository/maven/")
        mavenCentral()
    }
}

subprojects {
    apply(plugin = "java")
    apply(plugin = "io.spring.dependency-management")

    java {
        toolchain {
            languageVersion.set(JavaLanguageVersion.of(21))
        }
    }

    dependencyManagement {
        imports {
            mavenBom("org.springframework.boot:spring-boot-dependencies:3.3.4")
            mavenBom("org.springframework.cloud:spring-cloud-dependencies:2023.0.3")
        }
    }

    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
    }
}
