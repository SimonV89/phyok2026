package com.phyok.memoryembedding.application.service;

import com.phyok.contracts.MemoryProjectionEvent;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MemoryEmbeddingConsumerService {
    private final MemoryEmbeddingProviderClient memoryEmbeddingProviderClient;
    private final MemoryConsumerQdrantClient memoryConsumerQdrantClient;

    public MemoryEmbeddingConsumerService(
            MemoryEmbeddingProviderClient memoryEmbeddingProviderClient,
            MemoryConsumerQdrantClient memoryConsumerQdrantClient
    ) {
        this.memoryEmbeddingProviderClient = memoryEmbeddingProviderClient;
        this.memoryConsumerQdrantClient = memoryConsumerQdrantClient;
    }

    public void handle(MemoryProjectionEvent event) {
        if (event == null || event.fragmentId() == null || event.fragmentId().isBlank()) {
            throw new IllegalArgumentException("Memory projection event is invalid.");
        }
        if (event.deleted() || !event.searchable() || "DELETE".equalsIgnoreCase(event.eventType())) {
            memoryConsumerQdrantClient.deleteMemoryFragment(event.fragmentId());
            return;
        }
        List<Double> vector = memoryEmbeddingProviderClient.embed(event.contentText());
        memoryConsumerQdrantClient.upsertMemoryFragment(event, vector);
    }
}
