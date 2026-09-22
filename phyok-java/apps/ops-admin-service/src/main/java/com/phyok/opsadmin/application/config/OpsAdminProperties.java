package com.phyok.opsadmin.application.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "phyok.ops-admin")
public class OpsAdminProperties {
    private long totalUsers = 1024L;
    private long paidUsers = 188L;
    private long complaintCount = 3L;
    private long auditEventCount = 98_452L;
    private String cpuLoad = "0.41";
    private String memoryUsage = "61%";
    private String diskUsage = "54%";

    public long getTotalUsers() {
        return totalUsers;
    }

    public void setTotalUsers(long totalUsers) {
        this.totalUsers = totalUsers;
    }

    public long getPaidUsers() {
        return paidUsers;
    }

    public void setPaidUsers(long paidUsers) {
        this.paidUsers = paidUsers;
    }

    public long getComplaintCount() {
        return complaintCount;
    }

    public void setComplaintCount(long complaintCount) {
        this.complaintCount = complaintCount;
    }

    public long getAuditEventCount() {
        return auditEventCount;
    }

    public void setAuditEventCount(long auditEventCount) {
        this.auditEventCount = auditEventCount;
    }

    public String getCpuLoad() {
        return cpuLoad;
    }

    public void setCpuLoad(String cpuLoad) {
        this.cpuLoad = cpuLoad;
    }

    public String getMemoryUsage() {
        return memoryUsage;
    }

    public void setMemoryUsage(String memoryUsage) {
        this.memoryUsage = memoryUsage;
    }

    public String getDiskUsage() {
        return diskUsage;
    }

    public void setDiskUsage(String diskUsage) {
        this.diskUsage = diskUsage;
    }
}
