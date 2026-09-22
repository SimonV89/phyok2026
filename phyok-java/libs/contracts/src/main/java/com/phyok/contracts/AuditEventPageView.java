package com.phyok.contracts;

import java.util.List;

public record AuditEventPageView(
        int pageNo,
        int pageSize,
        int total,
        List<AuditEventView> items
) {
}
