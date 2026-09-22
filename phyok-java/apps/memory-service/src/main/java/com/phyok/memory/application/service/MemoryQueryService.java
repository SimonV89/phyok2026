package com.phyok.memory.application.service;

import com.phyok.contracts.MemoryGateCheckView;
import com.phyok.contracts.MemoryFragmentPageView;
import com.phyok.contracts.MemoryFragmentView;
import com.phyok.contracts.MemoryRecallHitView;
import com.phyok.contracts.MemoryRetrievalPreviewView;
import com.phyok.memory.application.config.MemoryProperties;
import com.phyok.memory.infrastructure.mybatis.entity.MemoryFragmentDO;
import com.phyok.memory.infrastructure.repository.MemoryFragmentRepository;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.List;
import java.util.Set;

@Service
public class MemoryQueryService {
    private static final Set<String> TIMELINE_ROOTS = Set.of("EARLY", "CHILDHOOD", "STUDENT", "WORK", "TODAY");
    private final MemoryProperties properties;
    private final MemoryFragmentRepository memoryFragmentRepository;

    public MemoryQueryService(
            MemoryProperties properties,
            MemoryFragmentRepository memoryFragmentRepository
    ) {
        this.properties = properties;
        this.memoryFragmentRepository = memoryFragmentRepository;
    }

    public MemoryGateCheckView gateCheck(String tenantId, String appId, String userId) {
        int currentCount = memoryFragmentRepository.countSearchableFragments(tenantId, appId, userId);
        return new MemoryGateCheckView(
                currentCount,
                properties.getGateRequiredCount(),
                currentCount >= properties.getGateRequiredCount()
        );
    }

    public MemoryRetrievalPreviewView retrievalPreview(String tenantId, String appId, String userId, String query) {
        List<MemoryFragmentDO> fragments = memoryFragmentRepository.findLatestSearchableFragments(
                tenantId,
                appId,
                userId,
                properties.getPreviewTopK()
        );
        return new MemoryRetrievalPreviewView(
                query,
                properties.getPreviewTopK(),
                properties.getRetrievalMode(),
                properties.isRerankEnabled(),
                properties.getQdrantCollection(),
                mapHits(fragments)
        );
    }

    public MemoryFragmentPageView listFragments(
            String tenantId,
            String appId,
            String userId,
            String timelineRoot,
            Integer pageNo,
            Integer pageSize
    ) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 10 : Math.min(pageSize, 100);
        int offset = (safePageNo - 1) * safePageSize;
        String normalizedTimelineRoot = normalizeTimelineRoot(timelineRoot);
        int total = memoryFragmentRepository.countFragments(tenantId, appId, userId, normalizedTimelineRoot);
        List<MemoryFragmentView> items = memoryFragmentRepository.findFragmentsPage(
                        tenantId,
                        appId,
                        userId,
                        normalizedTimelineRoot,
                        safePageSize,
                        offset
                ).stream()
                .map(this::toFragmentView)
                .toList();
        return new MemoryFragmentPageView(safePageNo, safePageSize, total, items);
    }

    private List<MemoryRecallHitView> mapHits(List<MemoryFragmentDO> fragments) {
        int size = Math.max(fragments.size(), 1);
        return java.util.stream.IntStream.range(0, fragments.size())
                .mapToObj(index -> toHit(fragments.get(index), index, size))
                .toList();
    }

    private MemoryFragmentView toFragmentView(MemoryFragmentDO fragment) {
        return new MemoryFragmentView(
                fragment.getId(),
                fragment.getTimelineRoot(),
                fragment.getContentText(),
                fragment.isSearchable(),
                fragment.getCreatedAt()
        );
    }

    private MemoryRecallHitView toHit(MemoryFragmentDO fragment, int index, int size) {
        double score = Math.max(0.55d, 0.95d - ((double) index / (double) size) * 0.20d);
        return new MemoryRecallHitView(
                fragment.getId(),
                buildTitle(fragment.getContentText()),
                score,
                fragment.getTimelineRoot()
        );
    }

    private String buildTitle(String contentText) {
        if (contentText == null || contentText.isBlank()) {
            return "未命名记忆碎片";
        }
        String normalized = contentText.replace('\n', ' ').trim();
        return normalized.length() <= 18 ? normalized : normalized.substring(0, 18) + "...";
    }

    private String normalizeTimelineRoot(String timelineRoot) {
        if (timelineRoot == null || timelineRoot.isBlank()) {
            return null;
        }
        String normalized = timelineRoot.trim().toUpperCase(Locale.ROOT);
        return TIMELINE_ROOTS.contains(normalized) ? normalized : null;
    }
}
