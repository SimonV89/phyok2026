package com.phyok.payment.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.payment.application.config.PaymentProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class AlipayGatewayClient {
    private static final String TRADE_QUERY_METHOD = "alipay.trade.query";

    private final PaymentProperties paymentProperties;
    private final AlipaySignatureService alipaySignatureService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public AlipayGatewayClient(
            PaymentProperties paymentProperties,
            AlipaySignatureService alipaySignatureService,
            ObjectMapper objectMapper
    ) {
        this.paymentProperties = paymentProperties;
        this.alipaySignatureService = alipaySignatureService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
    }

    public Optional<TradeQueryResult> queryTrade(String orderNo) {
        String bizContent = String.format(Locale.ROOT, "{\"out_trade_no\":\"%s\"}", escapeJson(orderNo));
        Map<String, String> params = alipaySignatureService.buildSignedParams(TRADE_QUERY_METHOD, bizContent);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(paymentProperties.getAlipayGateway()))
                .header("Content-Type", "application/x-www-form-urlencoded;charset=" + paymentProperties.getAlipayCharset())
                .POST(HttpRequest.BodyPublishers.ofString(formEncoded(params)))
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return parseTradeQueryResponse(response.body());
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to query Alipay order status.", exception);
        }
    }

    private Optional<TradeQueryResult> parseTradeQueryResponse(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        JsonNode responseNode = root.path("alipay_trade_query_response");
        if (responseNode.isMissingNode() || responseNode.path("code").isMissingNode()) {
            return Optional.empty();
        }
        String code = responseNode.path("code").asText("");
        if (!"10000".equals(code)) {
            return Optional.empty();
        }
        String tradeStatus = responseNode.path("trade_status").asText("");
        String tradeNo = responseNode.path("trade_no").asText(null);
        String buyerId = responseNode.path("buyer_user_id").asText(null);
        String totalAmount = responseNode.path("total_amount").asText(null);
        String buyerLogonId = responseNode.path("buyer_logon_id").asText(null);
        return Optional.of(new TradeQueryResult(tradeStatus, tradeNo, buyerId, totalAmount, buyerLogonId));
    }

    private String formEncoded(Map<String, String> params) {
        return params.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public record TradeQueryResult(
            String tradeStatus,
            String tradeNo,
            String buyerId,
            String totalAmount,
            String buyerLogonId
    ) {
    }
}
