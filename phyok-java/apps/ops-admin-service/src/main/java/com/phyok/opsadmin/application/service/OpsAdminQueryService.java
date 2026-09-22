package com.phyok.opsadmin.application.service;

import com.phyok.contracts.AdminDashboardOverviewView;
import com.phyok.opsadmin.application.config.OpsAdminProperties;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class OpsAdminQueryService {
    private final OpsAdminProperties properties;

    public OpsAdminQueryService(OpsAdminProperties properties) {
        this.properties = properties;
    }

    public AdminDashboardOverviewView overview() {
        return new AdminDashboardOverviewView(
                properties.getTotalUsers(),
                properties.getPaidUsers(),
                properties.getComplaintCount(),
                properties.getAuditEventCount()
        );
    }

    public Map<String, Object> resourceSummary() {
        return Map.of(
                "cpuLoad", properties.getCpuLoad(),
                "memoryUsage", properties.getMemoryUsage(),
                "diskUsage", properties.getDiskUsage()
        );
    }
}
