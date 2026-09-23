package com.phyok.payment.application.service;

import com.phyok.payment.application.config.PaymentProperties;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Component
public class AlipaySignatureService {
    private static final DateTimeFormatter ALIPAY_TS_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final PaymentProperties paymentProperties;

    public AlipaySignatureService(PaymentProperties paymentProperties) {
        this.paymentProperties = paymentProperties;
    }

    public String buildPagePayUrl(PaymentOrderService.PaymentOrderRecord order) {
        Map<String, String> params = buildSignedParams(
                paymentProperties.getAlipayPagePayMethod(),
                buildBizContent(order),
                true
        );
        return paymentProperties.getAlipayGateway() + "?" + toUrlEncodedQuery(params);
    }

    public Map<String, String> buildSignedParams(String method, String bizContent) {
        return buildSignedParams(method, bizContent, false);
    }

    public Map<String, String> buildSignedParams(String method, String bizContent, boolean includeCallbackUrls) {
        ensureReady();
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_id", paymentProperties.getAlipayAppId());
        params.put("method", method);
        params.put("charset", paymentProperties.getAlipayCharset());
        params.put("sign_type", paymentProperties.getAlipaySignType());
        params.put("timestamp", ALIPAY_TS_FORMATTER.format(OffsetDateTime.now()));
        params.put("version", paymentProperties.getAlipayVersion());
        if (includeCallbackUrls) {
            params.put("notify_url", absoluteUrl(paymentProperties.getAlipayNotifyPath()));
            params.put("return_url", absoluteUrl(paymentProperties.getAlipayReturnPath()));
        }
        params.put("biz_content", bizContent);
        params.put("sign", sign(params));
        return params;
    }

    public boolean verifyCallback(Map<String, String> callbackParams) {
        ensureReady();
        String sign = callbackParams.get("sign");
        if (sign == null || sign.isBlank()) {
            return false;
        }
        String content = canonicalContent(callbackParams);
        try {
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(parsePublicKey(paymentProperties.getAlipayPublicKey()));
            verifier.update(content.getBytes(StandardCharsets.UTF_8));
            return verifier.verify(Base64.getDecoder().decode(sign));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to verify Alipay callback signature.", exception);
        }
    }

    private String buildBizContent(PaymentOrderService.PaymentOrderRecord order) {
        return String.format(
                Locale.ROOT,
                "{\"out_trade_no\":\"%s\",\"product_code\":\"FAST_INSTANT_TRADE_PAY\",\"total_amount\":\"%s\",\"subject\":\"%s\",\"timeout_express\":\"%s\"}",
                escapeJson(order.orderNo()),
                formatFen(order.amountFen()),
                escapeJson(order.subject()),
                escapeJson(paymentProperties.getAlipayTimeoutExpress())
        );
    }

    private String formatFen(int amountFen) {
        return String.format(Locale.ROOT, "%.2f", Math.max(0, amountFen) / 100.0);
    }

    private String sign(Map<String, String> params) {
        String content = canonicalContent(params);
        try {
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initSign(parsePrivateKey(paymentProperties.getAlipayAppPrivateKey()));
            signature.update(content.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signature.sign());
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to sign Alipay request.", exception);
        }
    }

    private String canonicalContent(Map<String, String> params) {
        return new TreeMap<>(params).entrySet().stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isBlank())
                .filter(entry -> !"sign".equals(entry.getKey()))
                .filter(entry -> !"sign_type".equals(entry.getKey()))
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining("&"));
    }

    private String toUrlEncodedQuery(Map<String, String> params) {
        return params.entrySet().stream()
                .map(entry -> urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String absoluteUrl(String path) {
        String baseUrl = paymentProperties.getAppBaseUrl();
        if (baseUrl.endsWith("/") && path.startsWith("/")) {
            return baseUrl.substring(0, baseUrl.length() - 1) + path;
        }
        if (!baseUrl.endsWith("/") && !path.startsWith("/")) {
            return baseUrl + "/" + path;
        }
        return baseUrl + path;
    }

    private void ensureReady() {
        if (!paymentProperties.isAlipayEnabled()) {
            throw new IllegalStateException("Alipay is disabled.");
        }
        if (paymentProperties.getAlipayAppId() == null || paymentProperties.getAlipayAppId().isBlank()) {
            throw new IllegalStateException("Missing ALIPAY_APP_ID.");
        }
        if (paymentProperties.getAlipayAppPrivateKey() == null || paymentProperties.getAlipayAppPrivateKey().isBlank()) {
            throw new IllegalStateException("Missing ALIPAY_APP_PRIVATE_KEY.");
        }
        if (paymentProperties.getAlipayPublicKey() == null || paymentProperties.getAlipayPublicKey().isBlank()) {
            throw new IllegalStateException("Missing ALIPAY_PUBLIC_KEY.");
        }
    }

    private PrivateKey parsePrivateKey(String rawKey) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(normalizeKey(rawKey));
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(keyBytes));
    }

    private PublicKey parsePublicKey(String rawKey) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(normalizeKey(rawKey));
        return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(keyBytes));
    }

    private String normalizeKey(String rawKey) {
        return rawKey
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s+", "");
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
