package com.phyok.contracts;

public record AdminDashboardOverviewView(
        long totalUsers,
        long paidUsers,
        long complaintCount,
        long auditEventCount
) {
}
