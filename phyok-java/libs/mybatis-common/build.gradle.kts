plugins {
    `java-library`
}

dependencies {
    api(project(":libs:web-common"))
    api("org.mybatis.spring.boot:mybatis-spring-boot-starter:3.0.3")
    api("org.springframework.boot:spring-boot-starter-jdbc")
}
