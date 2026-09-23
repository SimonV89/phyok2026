package com.phyok.contracts;

import java.util.List;

public record ComplaintTicketPageView(
        int pageNo,
        int pageSize,
        int total,
        List<ComplaintTicketView> items
) {
}
