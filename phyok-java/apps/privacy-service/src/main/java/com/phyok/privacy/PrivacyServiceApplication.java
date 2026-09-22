package com.phyok.privacy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.phyok")
public class PrivacyServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(PrivacyServiceApplication.class, args);
    }
}
