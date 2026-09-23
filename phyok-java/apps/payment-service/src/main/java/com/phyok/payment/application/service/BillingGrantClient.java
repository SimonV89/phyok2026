package com.phyok.payment.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.payment.application.config.PaymentProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class BillingGrantClient {
    private final PaymentProperties paymentProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public BillingGrantClient(PaymentProperties paymentProperties, ObjectMapper objectMapper) {
        this.paymentProperties = paymentProperties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
    }

    public Map<String, Object> grantPaidOrder(PaymentOrderService.PaymentOrderRecord order) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("orderNo", order.orderNo());
        body.put("userEmail", order.userEmail());
        body.put("planId", order.planId());
        body.put("quota", order.quota());
        body.put("amountFen", order.amountFen());
        body.put("paymentChannel", "alipay");

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(paymentProperties.getBillingBaseUrl() + "/internal/billing/grant-purchase"))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("X-Request-Id", "req-payment-grant-" + order.orderNo())
                .POST(HttpRequest.BodyPublishers.ofString(writeJson(body), StandardCharsets.UTF_8))
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode root = objectMapper.readTree(response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300 || !"OK".equals(root.path("code").asText())) {
                throw new IllegalStateException("Billing grant request failed.");
            }
            JsonNode data = root.path("data");
            return objectMapper.convertValue(data, Map.class);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to grant purchased quota in billing-service.", exception);
        }
    }

    private String writeJson(Map<String, Object> body) {
        try {
            return objectMapper.writeValueAsString(body);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to serialize billing grant payload.", exception);
        }
    }
}
