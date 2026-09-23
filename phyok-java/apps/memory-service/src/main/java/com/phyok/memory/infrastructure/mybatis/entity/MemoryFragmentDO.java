package com.phyok.memory.infrastructure.mybatis.entity;

import java.time.OffsetDateTime;

public class MemoryFragmentDO {
    private String id;
    private String tenantId;
    private String appId;
    private String userId;
    private String timelineRoot;
    private String contentText;
    private boolean searchable;
    private String fragmentType;
    private String visibility;
    private String timeBucket;
    private String topicTags;
    private String emotionTags;
    private Integer chunkSeq;
    private Double chunkConfidence;
    private String chunkStrategy;
    private boolean deleted;
    private OffsetDateTime createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getTimelineRoot() {
        return timelineRoot;
    }

    public void setTimelineRoot(String timelineRoot) {
        this.timelineRoot = timelineRoot;
    }

    public String getContentText() {
        return contentText;
    }

    public void setContentText(String contentText) {
        this.contentText = contentText;
    }

    public boolean isSearchable() {
        return searchable;
    }

    public void setSearchable(boolean searchable) {
        this.searchable = searchable;
    }

    public String getFragmentType() {
        return fragmentType;
    }

    public void setFragmentType(String fragmentType) {
        this.fragmentType = fragmentType;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public String getTimeBucket() {
        return timeBucket;
    }

    public void setTimeBucket(String timeBucket) {
        this.timeBucket = timeBucket;
    }

    public String getTopicTags() {
        return topicTags;
    }

    public void setTopicTags(String topicTags) {
        this.topicTags = topicTags;
    }

    public String getEmotionTags() {
        return emotionTags;
    }

    public void setEmotionTags(String emotionTags) {
        this.emotionTags = emotionTags;
    }

    public Integer getChunkSeq() {
        return chunkSeq;
    }

    public void setChunkSeq(Integer chunkSeq) {
        this.chunkSeq = chunkSeq;
    }

    public Double getChunkConfidence() {
        return chunkConfidence;
    }

    public void setChunkConfidence(Double chunkConfidence) {
        this.chunkConfidence = chunkConfidence;
    }

    public String getChunkStrategy() {
        return chunkStrategy;
    }

    public void setChunkStrategy(String chunkStrategy) {
        this.chunkStrategy = chunkStrategy;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
