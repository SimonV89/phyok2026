package com.phyok.memoryembedding;

import com.phyok.memoryembedding.application.config.MemoryEmbeddingConsumerProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.kafka.annotation.EnableKafka;

@EnableKafka
@SpringBootApplication(scanBasePackages = "com.phyok")
@EnableConfigurationProperties(MemoryEmbeddingConsumerProperties.class)
public class MemoryEmbeddingConsumerApplication {
    public static void main(String[] args) {
        SpringApplication.run(MemoryEmbeddingConsumerApplication.class, args);
    }
}
