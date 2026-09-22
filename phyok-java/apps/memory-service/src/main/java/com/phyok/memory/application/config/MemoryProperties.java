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
}
