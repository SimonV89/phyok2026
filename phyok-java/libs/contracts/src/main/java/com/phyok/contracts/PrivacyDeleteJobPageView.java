package com.phyok.contracts;

import java.util.List;

public record PrivacyDeleteJobPageView(
        int pageNo,
        int pageSize,
        int total,
        List<PrivacyDeleteJobView> items
) {
}
