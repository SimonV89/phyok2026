package com.phyok.contracts;

public record PrivacyEraseStatusView(
        int runningJobs,
        int queuedJobs,
        String lastCompensationState
) {
}
