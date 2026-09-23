package com.phyok.contracts;

import java.util.List;

public record PaymentOrderPageView(
        int pageNo,
        int pageSize,
        int total,
        List<PaymentOrderListItemView> items
) {
}
