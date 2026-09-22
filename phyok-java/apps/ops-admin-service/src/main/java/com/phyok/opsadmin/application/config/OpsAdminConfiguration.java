package com.phyok.opsadmin.application.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(OpsAdminProperties.class)
public class OpsAdminConfiguration {
}
