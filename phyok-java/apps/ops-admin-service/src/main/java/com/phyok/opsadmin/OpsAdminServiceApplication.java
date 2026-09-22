package com.phyok.opsadmin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.phyok")
public class OpsAdminServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OpsAdminServiceApplication.class, args);
    }
}
