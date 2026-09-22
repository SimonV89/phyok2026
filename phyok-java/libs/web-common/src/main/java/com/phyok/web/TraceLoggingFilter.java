package com.phyok.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class TraceLoggingFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(TraceLoggingFilter.class);

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long startAt = System.currentTimeMillis();
        String requestId = String.valueOf(request.getAttribute(RequestIdFilter.ATTRIBUTE_NAME));
        String traceId = String.valueOf(request.getAttribute(RequestIdFilter.TRACE_ATTRIBUTE_NAME));

        MDC.put("requestId", requestId);
        MDC.put("traceId", traceId);
        MDC.put("method", request.getMethod());
        MDC.put("path", request.getRequestURI());

        try {
            log.info("request.started");
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = System.currentTimeMillis() - startAt;
            log.info("request.completed status={} durationMs={}", response.getStatus(), durationMs);
            MDC.clear();
        }
    }
}
