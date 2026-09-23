package com.phyok.contracts;

import java.util.List;

public record AdminUserPageView(
        int pageNo,
        int pageSize,
        int total,
        List<AdminUserView> items
) {
}
