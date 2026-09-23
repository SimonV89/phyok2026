package com.phyok.memoryembedding.application.config;

import com.phyok.qdrant.QdrantCollections;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "phyok.memory-consumer")
public class MemoryEmbeddingConsumerProperties {
    private boolean qdrantEnabled = true;
    private String qdrantUrl = "http://qdrant:6333";
    private String qdrantApiKey = "";
    private String qdrantCollection = QdrantCollections.USER_MEMORY_FRAGMENTS;
    private int qdrantVectorDimension = 1024;
    private int qdrantEmbeddingVersion = 1;
    private String embeddingBaseUrl = "https://api.siliconflow.cn/v1";
    private String embeddingApiKey = "";
    private String embeddingModel = "BAAI/bge-m3";
    private int embeddingTimeoutMs = 20000;

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

    public String getQdrantCollection() {
        return qdrantCollection;
    }

    public void setQdrantCollection(String qdrantCollection) {
        this.qdrantCollection = qdrantCollection;
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
}
