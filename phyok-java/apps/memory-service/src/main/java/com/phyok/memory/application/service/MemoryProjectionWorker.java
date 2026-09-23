package com.phyok.memory.application.service;

import com.phyok.memory.application.config.MemoryProperties;
import com.phyok.memory.infrastructure.mybatis.entity.MemoryProjectionOutboxDO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
public class MemoryProjectionWorker {
    private static final Logger log = LoggerFactory.getLogger(MemoryProjectionWorker.class);

    private final MemoryProperties memoryProperties;
    private final MemoryProjectionOutboxService memoryProjectionOutboxService;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public MemoryProjectionWorker(
            MemoryProperties memoryProperties,
            MemoryProjectionOutboxService memoryProjectionOutboxService,
            KafkaTemplate<String, String> kafkaTemplate
    ) {
        this.memoryProperties = memoryProperties;
        this.memoryProjectionOutboxService = memoryProjectionOutboxService;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Scheduled(fixedDelayString = "${phyok.memory.outbox-worker-fixed-delay-ms:3000}")
    public void projectPendingEvents() {
        if (!memoryProperties.isOutboxEnabled()) {
            return;
        }
        List<MemoryProjectionOutboxDO> items = memoryProjectionOutboxService.claimPendingEvents();
        for (MemoryProjectionOutboxDO item : items) {
            try {
                relay(item);
                memoryProjectionOutboxService.markCompleted(item.getId());
            } catch (Exception exception) {
                log.warn("Failed to process memory projection outbox, id={}", item.getId(), exception);
                int attempts = item.getAttemptCount() == null ? 1 : item.getAttemptCount() + 1;
                memoryProjectionOutboxService.markFailure(item.getId(), attempts, exception);
            }
        }
    }

    private void relay(MemoryProjectionOutboxDO item) throws Exception {
        kafkaTemplate.send(item.getTopicName(), item.getFragmentId(), item.getPayloadJson())
                .get(15, TimeUnit.SECONDS);
    }
}
