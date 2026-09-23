package com.phyok.billing.infrastructure.mybatis.entity;

import java.time.OffsetDateTime;

public class BillingGrantRecordDO {
    private String id;
    private String orderNo;
    private String appId;
    private String userEmail;
    private String planId;
    private int quota;
    private int amountFen;
    private String paymentChannel;
    private String status;
    private OffsetDateTime createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public String getAppId() { return appId; }
    public void setAppId(String appId) { this.appId = appId; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public String getPlanId() { return planId; }
    public void setPlanId(String planId) { this.planId = planId; }
    public int getQuota() { return quota; }
    public void setQuota(int quota) { this.quota = quota; }
    public int getAmountFen() { return amountFen; }
    public void setAmountFen(int amountFen) { this.amountFen = amountFen; }
    public String getPaymentChannel() { return paymentChannel; }
    public void setPaymentChannel(String paymentChannel) { this.paymentChannel = paymentChannel; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
