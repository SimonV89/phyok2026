package com.phyok.memory.application.config;

import com.phyok.qdrant.QdrantCollections;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "phyok.memory")
public class MemoryProperties {
    private int gateRequiredCount = 5;
    private int previewTopK = 6;
    private String retrievalMode = "hybrid-recall";
    private boolean rerankEnabled = true;
    private String qdrantCollection = QdrantCollections.USER_MEMORY_FRAGMENTS;
    private boolean qdrantEnabled = true;
    private String qdrantUrl = "http://qdrant:6333";
    private String qdrantApiKey = "";
    private int qdrantVectorDimension = 1024;
    private int qdrantEmbeddingVersion = 1;
    private boolean auditEnabled = true;
    private String auditBaseUrl = "http://audit-service:18087";
    private boolean semanticChunkEnabled = true;
    private String semanticChunkProvider = "siliconflow";
    private String semanticChunkBaseUrl = "https://api.siliconflow.cn/v1";
    private String semanticChunkApiKey = "";
    private String semanticChunkModel = "Pro/deepseek-ai/DeepSeek-V4";
    private int semanticChunkTimeoutMs = 30000;
    private int semanticChunkMaxChunks = 6;
    private int semanticChunkMinChars = 48;
    private int semanticChunkMaxChars = 180;
    private int semanticChunkLlmThresholdChars = 90;
    private String embeddingBaseUrl = "https://api.siliconflow.cn/v1";
    private String embeddingApiKey = "";
    private String embeddingModel = "BAAI/bge-m3";
    private int embeddingTimeoutMs = 20000;
    private boolean outboxEnabled = true;
    private int outboxWorkerBatchSize = 24;
    private int outboxWorkerFixedDelayMs = 3000;

    public int getGateRequiredCount() {
        return gateRequiredCount;
    }

    public void setGateRequiredCount(int gateRequiredCount) {
        this.gateRequiredCount = gateRequiredCount;
    }

    public int getPreviewTopK() {
        return previewTopK;
    }

    public void setPreviewTopK(int previewTopK) {
        this.previewTopK = previewTopK;
    }

    public String getRetrievalMode() {
        return retrievalMode;
    }

    public void setRetrievalMode(String retrievalMode) {
        this.retrievalMode = retrievalMode;
    }

    public boolean isRerankEnabled() {
        return rerankEnabled;
    }

    public void setRerankEnabled(boolean rerankEnabled) {
        this.rerankEnabled = rerankEnabled;
    }

    public String getQdrantCollection() {
        return qdrantCollection;
    }

    public void setQdrantCollection(String qdrantCollection) {
        this.qdrantCollection = qdrantCollection;
    }

    public boolean isQdrantEnabled() {
        return qdrantEnabled;
    }

    public void setQdrantEnabled(boolean qdrantEnabled) {
        this.qdrantEnabled = qdrantEnabled;
    }

    public String getQdrantUrl() {
        return qdrantUrl;
    }

    public void setQdrantUrl(String qdrantUrl) {
        this.qdrantUrl = qdrantUrl;
    }

    public String getQdrantApiKey() {
        return qdrantApiKey;
    }

    public void setQdrantApiKey(String qdrantApiKey) {
        this.qdrantApiKey = qdrantApiKey;
    }

    public int getQdrantVectorDimension() {
        return qdrantVectorDimension;
    }

    public void setQdrantVectorDimension(int qdrantVectorDimension) {
        this.qdrantVectorDimension = qdrantVectorDimension;
    }

    public int getQdrantEmbeddingVersion() {
        return qdrantEmbeddingVersion;
    }

    public void setQdrantEmbeddingVersion(int qdrantEmbeddingVersion) {
        this.qdrantEmbeddingVersion = qdrantEmbeddingVersion;
    }

    public boolean isAuditEnabled() {
        return auditEnabled;
    }

    public void setAuditEnabled(boolean auditEnabled) {
        this.auditEnabled = auditEnabled;
    }

    public String getAuditBaseUrl() {
        return auditBaseUrl;
    }

    public void setAuditBaseUrl(String auditBaseUrl) {
        this.auditBaseUrl = auditBaseUrl;
    }

    public boolean isSemanticChunkEnabled() {
        return semanticChunkEnabled;
    }

    public void setSemanticChunkEnabled(boolean semanticChunkEnabled) {
        this.semanticChunkEnabled = semanticChunkEnabled;
    }

    public String getSemanticChunkProvider() {
        return semanticChunkProvider;
    }

    public void setSemanticChunkProvider(String semanticChunkProvider) {
        this.semanticChunkProvider = semanticChunkProvider;
    }

    public String getSemanticChunkBaseUrl() {
        return semanticChunkBaseUrl;
    }

    public void setSemanticChunkBaseUrl(String semanticChunkBaseUrl) {
        this.semanticChunkBaseUrl = semanticChunkBaseUrl;
    }

    public String getSemanticChunkApiKey() {
        return semanticChunkApiKey;
    }

    public void setSemanticChunkApiKey(String semanticChunkApiKey) {
        this.semanticChunkApiKey = semanticChunkApiKey;
    }

    public String getSemanticChunkModel() {
        return semanticChunkModel;
    }

    public void setSemanticChunkModel(String semanticChunkModel) {
        this.semanticChunkModel = semanticChunkModel;
    }

    public int getSemanticChunkTimeoutMs() {
        return semanticChunkTimeoutMs;
    }

    public void setSemanticChunkTimeoutMs(int semanticChunkTimeoutMs) {
        this.semanticChunkTimeoutMs = semanticChunkTimeoutMs;
    }

    public int getSemanticChunkMaxChunks() {
        return semanticChunkMaxChunks;
    }

    public void setSemanticChunkMaxChunks(int semanticChunkMaxChunks) {
        this.semanticChunkMaxChunks = semanticChunkMaxChunks;
    }

    public int getSemanticChunkMinChars() {
        return semanticChunkMinChars;
    }

    public void setSemanticChunkMinChars(int semanticChunkMinChars) {
        this.semanticChunkMinChars = semanticChunkMinChars;
    }

    public int getSemanticChunkMaxChars() {
        return semanticChunkMaxChars;
    }

    public void setSemanticChunkMaxChars(int semanticChunkMaxChars) {
        this.semanticChunkMaxChars = semanticChunkMaxChars;
    }

    public int getSemanticChunkLlmThresholdChars() {
        return semanticChunkLlmThresholdChars;
    }

    public void setSemanticChunkLlmThresholdChars(int semanticChunkLlmThresholdChars) {
        this.semanticChunkLlmThresholdChars = semanticChunkLlmThresholdChars;
    }

    public String getEmbeddingBaseUrl() {
        return embeddingBaseUrl;
    }

    public void setEmbeddingBaseUrl(String embeddingBaseUrl) {
        this.embeddingBaseUrl = embeddingBaseUrl;
    }

    public String getEmbeddingApiKey() {
        return embeddingApiKey;
    }

    public void setEmbeddingApiKey(String embeddingApiKey) {
        this.embeddingApiKey = embeddingApiKey;
    }

    public String getEmbeddingModel() {
        return embeddingModel;
    }

    public void setEmbeddingModel(String embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    public int getEmbeddingTimeoutMs() {
        return embeddingTimeoutMs;
    }

    public void setEmbeddingTimeoutMs(int embeddingTimeoutMs) {
        this.embeddingTimeoutMs = embeddingTimeoutMs;
    }

    public boolean isOutboxEnabled() {
        return outboxEnabled;
    }

    public void setOutboxEnabled(boolean outboxEnabled) {
        this.outboxEnabled = outboxEnabled;
    }

    public int getOutboxWorkerBatchSize() {
        return outboxWorkerBatchSize;
    }

    public void setOutboxWorkerBatchSize(int outboxWorkerBatchSize) {
        this.outboxWorkerBatchSize = outboxWorkerBatchSize;
    }

    public int getOutboxWorkerFixedDelayMs() {
        return outboxWorkerFixedDelayMs;
    }

    public void setOutboxWorkerFixedDelayMs(int outboxWorkerFixedDelayMs) {
        this.outboxWorkerFixedDelayMs = outboxWorkerFixedDelayMs;
    }
}
