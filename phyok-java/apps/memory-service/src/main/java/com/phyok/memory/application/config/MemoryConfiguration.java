package com.phyok.memory.application.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(MemoryProperties.class)
public class MemoryConfiguration {
}
