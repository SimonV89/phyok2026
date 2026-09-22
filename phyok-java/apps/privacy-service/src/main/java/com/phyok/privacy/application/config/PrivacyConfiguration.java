package com.phyok.privacy.application.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(PrivacyProperties.class)
public class PrivacyConfiguration {
}
