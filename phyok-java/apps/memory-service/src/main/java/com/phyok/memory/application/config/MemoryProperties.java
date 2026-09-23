package com.phyok.memory.application.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "phyok.memory")
public class MemoryProperties {
    private int gateRequiredCount = 5;
    private int previewTopK = 6;
    private String retrievalMode = "hybrid-recall";
    private boolean rerankEnabled = true;
    private String qdrantCollection = "memory_chunks";
    private boolean auditEnabled = true;
    private String auditBaseUrl = "http://audit-service:18087";
    private boolean semanticChunkEnabled = true;
    private String semanticChunkProvider = "siliconflow";
    private String semanticChunkBaseUrl = "https://api.siliconflow.cn/v1";
    private String semanticChunkApiKey = "";
    private String semanticChunkModel = "Pro/deepseek-ai/DeepSeek-V4";
    private int semanticChunkTimeoutMs = 30000;
    private int semanticChunkMaxChunks = 6;
    private int semanticChunkMinChars = 80;
    private int semanticChunkMaxChars = 280;
    private int semanticChunkLlmThresholdChars = 120;

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
}
