package com.phyok.auth.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.auth.application.config.AuthEmailProperties;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Service
public class TencentSesTemplateEmailService {
    private static final String VERSION = "2020-10-02";
    private static final String SERVICE = "ses";

    private final AuthEmailProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public TencentSesTemplateEmailService(AuthEmailProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public void sendLoginCode(String toEmail, String code, String locale) {
        ensureRuntimeConfigured();

        int templateId = Integer.parseInt(resolveTemplateId(locale));
        int expireMinutes = Math.max(1, Math.round(properties.getCodeTtlSeconds() / 60.0f));
        String subject = locale != null && locale.toLowerCase().startsWith("zh")
                ? "[心理自愈Pro] 登录验证码：" + code
                : "[Psychological Self-Healing Pro] Login code: " + code;

        Map<String, Object> payload = Map.of(
                "FromEmailAddress", properties.getTencentSesFromEmail().trim(),
                "Destination", new String[]{toEmail},
                "Subject", subject,
                "Template", Map.of(
                        "TemplateID", templateId,
                        "TemplateData", toJson(Map.of(
                                "code", code,
                                "expire_minutes", String.valueOf(expireMinutes),
                                "support_email", properties.getTencentSesFromEmail().trim(),
                                "current_year", String.valueOf(Instant.now().atZone(ZoneOffset.UTC).getYear())
                        ))
                ),
                "TriggerType", 1,
                "Unsubscribe", "0"
        );

        callTencentSesApi("SendEmail", payload);
    }

    private String resolveTemplateId(String locale) {
        boolean zh = locale != null && locale.toLowerCase().startsWith("zh");
        return zh ? properties.getTencentSesTemplateZh().trim() : properties.getTencentSesTemplateEn().trim();
    }

    private void ensureRuntimeConfigured() {
        if (properties.getTencentSesSecretId().isBlank()
                || properties.getTencentSesSecretKey().isBlank()
                || properties.getTencentSesFromEmail().isBlank()
                || properties.getTencentSesTemplateEn().isBlank()
                || properties.getTencentSesTemplateZh().isBlank()) {
            throw new IllegalStateException("Tencent SES runtime is not configured.");
        }
    }

    private void callTencentSesApi(String action, Map<String, Object> payload) {
        try {
            String host = properties.getTencentSesApiEndpoint().replaceFirst("^https?://", "").replaceAll("/+$", "");
            long timestamp = Instant.now().getEpochSecond();
            String date = DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC).format(Instant.ofEpochSecond(timestamp));
            String payloadText = toJson(payload);

            String canonicalHeaders = "content-type:application/json; charset=utf-8\n"
                    + "host:" + host + "\n"
                    + "x-tc-action:" + action.toLowerCase() + "\n";
            String signedHeaders = "content-type;host;x-tc-action";
            String canonicalRequest = String.join("\n",
                    "POST",
                    "/",
                    "",
                    canonicalHeaders,
                    signedHeaders,
                    sha256Hex(payloadText)
            );

            String credentialScope = date + "/" + SERVICE + "/tc3_request";
            String stringToSign = String.join("\n",
                    "TC3-HMAC-SHA256",
                    String.valueOf(timestamp),
                    credentialScope,
                    sha256Hex(canonicalRequest)
            );

            String signature = tc3Sign(properties.getTencentSesSecretKey(), date, SERVICE, stringToSign);
            String authorization = String.join(" ",
                    "TC3-HMAC-SHA256",
                    "Credential=" + properties.getTencentSesSecretId() + "/" + credentialScope + ",",
                    "SignedHeaders=" + signedHeaders + ",",
                    "Signature=" + signature
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://" + host + "/"))
                    .header("Authorization", authorization)
                    .header("Content-Type", "application/json; charset=utf-8")
                    .header("X-TC-Action", action)
                    .header("X-TC-Version", VERSION)
                    .header("X-TC-Region", properties.getTencentSesRegion())
                    .header("X-TC-Timestamp", String.valueOf(timestamp))
                    .POST(HttpRequest.BodyPublishers.ofString(payloadText, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode wrapped = root.path("Response");
            JsonNode error = wrapped.path("Error");
            if (response.statusCode() >= 400 || !error.isMissingNode()) {
                String code = error.path("Code").asText("TencentSesRequestFailed");
                String message = error.path("Message").asText("HTTP " + response.statusCode());
                throw new IllegalStateException(code + ": " + message);
            }
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to send verification email via Tencent SES: " + exception.getMessage(), exception);
        }
    }

    private String toJson(Object input) {
        try {
            return objectMapper.writeValueAsString(input);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to serialize Tencent SES payload.", exception);
        }
    }

    private String tc3Sign(String secretKey, String date, String service, String stringToSign) throws Exception {
        byte[] secretDate = hmacSha256(("TC3" + secretKey).getBytes(StandardCharsets.UTF_8), date);
        byte[] secretService = hmacSha256(secretDate, service);
        byte[] secretSigning = hmacSha256(secretService, "tc3_request");
        return hex(hmacSha256(secretSigning, stringToSign));
    }

    private byte[] hmacSha256(byte[] key, String raw) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(raw.getBytes(StandardCharsets.UTF_8));
    }

    private String sha256Hex(String raw) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return hex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
    }

    private String hex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }
}
