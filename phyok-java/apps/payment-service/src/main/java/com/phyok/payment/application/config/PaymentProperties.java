package com.phyok.payment.application.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "phyok.payment")
public class PaymentProperties {
    private String appBaseUrl = "https://www.phyok.com";
    private String billingBaseUrl = "http://billing-service:18085";
    private boolean alipayEnabled = true;
    private String alipayAppId = "";
    private String alipayGateway = "https://openapi.alipay.com/gateway.do";
    private String alipayAppPrivateKey = "";
    private String alipayPublicKey = "";
    private String alipayNotifyPath = "/api/pay/alipay/notify";
    private String alipayReturnPath = "/payment/result";
    private String alipayTimeoutExpress = "15m";
    private boolean alipayDebug = false;
    private String alipayCharset = "utf-8";
    private String alipaySignType = "RSA2";
    private String alipayVersion = "1.0";
    private String alipayPagePayMethod = "alipay.trade.page.pay";
    private String alipayWapPayMethod = "alipay.trade.wap.pay";
    private String sellerName = "心理学空间";

    public String getAppBaseUrl() {
        return appBaseUrl;
    }

    public void setAppBaseUrl(String appBaseUrl) {
        this.appBaseUrl = appBaseUrl;
    }

    public String getBillingBaseUrl() {
        return billingBaseUrl;
    }

    public void setBillingBaseUrl(String billingBaseUrl) {
        this.billingBaseUrl = billingBaseUrl;
    }

    public boolean isAlipayEnabled() {
        return alipayEnabled;
    }

    public void setAlipayEnabled(boolean alipayEnabled) {
        this.alipayEnabled = alipayEnabled;
    }

    public String getAlipayAppId() {
        return alipayAppId;
    }

    public void setAlipayAppId(String alipayAppId) {
        this.alipayAppId = alipayAppId;
    }

    public String getAlipayGateway() {
        return alipayGateway;
    }

    public void setAlipayGateway(String alipayGateway) {
        this.alipayGateway = alipayGateway;
    }

    public String getAlipayAppPrivateKey() {
        return alipayAppPrivateKey;
    }

    public void setAlipayAppPrivateKey(String alipayAppPrivateKey) {
        this.alipayAppPrivateKey = alipayAppPrivateKey;
    }

    public String getAlipayPublicKey() {
        return alipayPublicKey;
    }

    public void setAlipayPublicKey(String alipayPublicKey) {
        this.alipayPublicKey = alipayPublicKey;
    }

    public String getAlipayNotifyPath() {
        return alipayNotifyPath;
    }

    public void setAlipayNotifyPath(String alipayNotifyPath) {
        this.alipayNotifyPath = alipayNotifyPath;
    }

    public String getAlipayReturnPath() {
        return alipayReturnPath;
    }

    public void setAlipayReturnPath(String alipayReturnPath) {
        this.alipayReturnPath = alipayReturnPath;
    }

    public String getAlipayTimeoutExpress() {
        return alipayTimeoutExpress;
    }

    public void setAlipayTimeoutExpress(String alipayTimeoutExpress) {
        this.alipayTimeoutExpress = alipayTimeoutExpress;
    }

    public boolean isAlipayDebug() {
        return alipayDebug;
    }

    public void setAlipayDebug(boolean alipayDebug) {
        this.alipayDebug = alipayDebug;
    }

    public String getAlipayCharset() {
        return alipayCharset;
    }

    public void setAlipayCharset(String alipayCharset) {
        this.alipayCharset = alipayCharset;
    }

    public String getAlipaySignType() {
        return alipaySignType;
    }

    public void setAlipaySignType(String alipaySignType) {
        this.alipaySignType = alipaySignType;
    }

    public String getAlipayVersion() {
        return alipayVersion;
    }

    public void setAlipayVersion(String alipayVersion) {
        this.alipayVersion = alipayVersion;
    }

    public String getAlipayPagePayMethod() {
        return alipayPagePayMethod;
    }

    public void setAlipayPagePayMethod(String alipayPagePayMethod) {
        this.alipayPagePayMethod = alipayPagePayMethod;
    }

    public String getAlipayWapPayMethod() {
        return alipayWapPayMethod;
    }

    public void setAlipayWapPayMethod(String alipayWapPayMethod) {
        this.alipayWapPayMethod = alipayWapPayMethod;
    }

    public String getSellerName() {
        return sellerName;
    }

    public void setSellerName(String sellerName) {
        this.sellerName = sellerName;
    }
}
