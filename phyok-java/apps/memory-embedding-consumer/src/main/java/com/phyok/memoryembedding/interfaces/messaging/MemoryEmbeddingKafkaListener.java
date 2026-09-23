package com.phyok.memoryembedding.interfaces.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.contracts.MemoryProjectionEvent;
import com.phyok.kafka.TopicNames;
import com.phyok.memoryembedding.application.service.MemoryEmbeddingConsumerService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class MemoryEmbeddingKafkaListener {
    private final ObjectMapper objectMapper;
    private final MemoryEmbeddingConsumerService memoryEmbeddingConsumerService;

    public MemoryEmbeddingKafkaListener(
            ObjectMapper objectMapper,
            MemoryEmbeddingConsumerService memoryEmbeddingConsumerService
    ) {
        this.objectMapper = objectMapper;
        this.memoryEmbeddingConsumerService = memoryEmbeddingConsumerService;
    }

    @KafkaListener(
            topics = {
                    TopicNames.MEMORY_FRAGMENT_CREATED,
                    TopicNames.MEMORY_EMBEDDING_REQUESTED
            },
            groupId = "${spring.kafka.consumer.group-id:memory-embedding-consumer}"
    )
    public void onMessage(String payload) throws Exception {
        MemoryProjectionEvent event = objectMapper.readValue(payload, MemoryProjectionEvent.class);
        memoryEmbeddingConsumerService.handle(event);
    }
}
