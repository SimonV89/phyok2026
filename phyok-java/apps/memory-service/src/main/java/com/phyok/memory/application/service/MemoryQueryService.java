package com.phyok.memory.application.service;

import com.phyok.contracts.MemoryGateCheckView;
import com.phyok.contracts.MemoryFragmentPageView;
import com.phyok.contracts.MemoryRetrieveResultView;
import com.phyok.contracts.MemoryFragmentView;
import com.phyok.contracts.MemoryRecallHitView;
import com.phyok.contracts.MemoryRetrievalPreviewView;
import com.phyok.contracts.RetrievedMemoryFragmentView;
import com.phyok.contracts.MemoryStarMapView;
import com.phyok.memory.application.config.MemoryProperties;
import com.phyok.memory.infrastructure.mybatis.entity.MemoryFragmentDO;
import com.phyok.memory.infrastructure.repository.MemoryFragmentRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;

@Service
public class MemoryQueryService {
    private static final Set<String> TIMELINE_ROOTS = Set.of("EARLY", "CHILDHOOD", "STUDENT", "WORK", "TODAY");
    private static final List<String> TIMELINE_ORDER = List.of("EARLY", "CHILDHOOD", "STUDENT", "WORK", "TODAY");
    private static final double PEER_LINK_THRESHOLD = 0.18d;
    private static final int MAX_PEERS_PER_NODE = 2;
    private final MemoryProperties properties;
    private final MemoryFragmentRepository memoryFragmentRepository;
    private final MemoryEmbeddingClient memoryEmbeddingClient;
    private final MemoryQdrantClient memoryQdrantClient;

    public MemoryQueryService(
            MemoryProperties properties,
            MemoryFragmentRepository memoryFragmentRepository,
            MemoryEmbeddingClient memoryEmbeddingClient,
            MemoryQdrantClient memoryQdrantClient
    ) {
        this.properties = properties;
        this.memoryFragmentRepository = memoryFragmentRepository;
        this.memoryEmbeddingClient = memoryEmbeddingClient;
        this.memoryQdrantClient = memoryQdrantClient;
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
        List<RetrievedMemoryFragmentView> items = retrieveMemoryItems(
                tenantId,
                appId,
                userId,
                query,
                properties.getPreviewTopK(),
                null,
                List.of(),
                List.of()
        );
        return new MemoryRetrievalPreviewView(
                query,
                properties.getPreviewTopK(),
                properties.isQdrantEnabled() ? "qdrant-recall-pg-enrich" : properties.getRetrievalMode(),
                properties.isRerankEnabled(),
                properties.getQdrantCollection(),
                items.stream().map(this::toPreviewHit).toList()
        );
    }

    public MemoryRetrieveResultView retrieveMemory(
            String tenantId,
            String appId,
            String userId,
            String query,
            Integer topK,
            Double minScore,
            List<String> timelineRoots,
            List<String> topicTags
    ) {
        int safeTopK = topK == null || topK < 1 ? properties.getPreviewTopK() : Math.min(topK, 20);
        double safeMinScore = minScore == null || minScore <= 0d ? 0.68d : Math.min(Math.max(minScore, 0.01d), 0.99d);
        List<RetrievedMemoryFragmentView> items = retrieveMemoryItems(
                tenantId,
                appId,
                userId,
                query,
                safeTopK,
                safeMinScore,
                normalizeTimelineRoots(timelineRoots),
                normalizeTags(topicTags)
        );
        return new MemoryRetrieveResultView(query, safeTopK, safeMinScore, items);
    }

    public MemoryStarMapView buildStarMap(
            String tenantId,
            String appId,
            String userId,
            String timelineRoot,
            Integer limit
    ) {
        int safeLimit = Math.max(12, Math.min(limit == null ? 180 : limit, 260));
        String normalizedTimelineRoot = normalizeTimelineRoot(timelineRoot);
        List<MemoryFragmentDO> fragments = memoryFragmentRepository.findLatestSearchableFragments(
                tenantId,
                appId,
                userId,
                safeLimit
        );
        List<MemoryFragmentDO> filteredFragments = fragments.stream()
                .filter(fragment -> normalizedTimelineRoot == null || normalizedTimelineRoot.equals(fragment.getTimelineRoot()))
                .toList();

        List<String> visibleRoots = normalizedTimelineRoot == null
                ? TIMELINE_ORDER
                : TIMELINE_ORDER.stream().filter(root -> root.equals(normalizedTimelineRoot)).toList();

        List<MemoryStarMapView.Node> nodes = new ArrayList<>();
        for (String root : visibleRoots) {
            nodes.add(new MemoryStarMapView.Node(
                    "root-" + root.toLowerCase(Locale.ROOT),
                    "root",
                    root,
                    root,
                    null,
                    null,
                    "memory-service",
                    null,
                    List.of(root),
                    null
            ));
        }

        int size = Math.max(filteredFragments.size(), 1);
        for (int index = 0; index < filteredFragments.size(); index += 1) {
            MemoryFragmentDO fragment = filteredFragments.get(index);
            double score = Math.max(0.56d, 0.96d - ((double) index / (double) size) * 0.24d);
            nodes.add(new MemoryStarMapView.Node(
                    fragment.getId(),
                    "memory",
                    fragment.getTimelineRoot(),
                    buildTitle(fragment.getContentText()),
                    fragment.getContentText(),
                    score,
                    "memory-service",
                    null,
                    buildTags(fragment),
                    fragment.getCreatedAt()
            ));
        }

        List<MemoryStarMapView.Link> links = new ArrayList<>();
        for (MemoryFragmentDO fragment : filteredFragments) {
            links.add(new MemoryStarMapView.Link(
                    "root-" + fragment.getTimelineRoot().toLowerCase(Locale.ROOT),
                    fragment.getId(),
                    "root",
                    1.0d
            ));
        }

        Map<String, List<MemoryFragmentDO>> groupedByTimeline = filteredFragments.stream()
                .collect(Collectors.groupingBy(
                        MemoryFragmentDO::getTimelineRoot,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        Set<String> existingPairs = new HashSet<>();
        for (List<MemoryFragmentDO> timelineFragments : groupedByTimeline.values()) {
            for (MemoryFragmentDO current : timelineFragments) {
                List<PeerCandidate> candidates = new ArrayList<>();
                for (MemoryFragmentDO candidate : timelineFragments) {
                    if (current.getId().equals(candidate.getId())) {
                        continue;
                    }
                    double similarity = computeSimilarity(current.getContentText(), candidate.getContentText());
                    if (similarity > PEER_LINK_THRESHOLD) {
                        candidates.add(new PeerCandidate(candidate, similarity));
                    }
                }
                candidates.stream()
                        .sorted(Comparator.comparingDouble(PeerCandidate::score).reversed())
                        .limit(MAX_PEERS_PER_NODE)
                        .forEach(candidate -> {
                            String pairKey = buildPairKey(current.getId(), candidate.fragment().getId());
                            if (!existingPairs.add(pairKey)) {
                                return;
                            }
                            links.add(new MemoryStarMapView.Link(
                                    current.getId(),
                                    candidate.fragment().getId(),
                                    "peer",
                                    candidate.score()
                            ));
                        });
            }
        }

        return new MemoryStarMapView(
                normalizedTimelineRoot == null ? "all" : normalizedTimelineRoot.toLowerCase(Locale.ROOT),
                safeLimit,
                filteredFragments.size(),
                nodes,
                links
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

    private List<RetrievedMemoryFragmentView> retrieveMemoryItems(
            String tenantId,
            String appId,
            String userId,
            String query,
            int topK,
            Double minScore,
            List<String> timelineRoots,
            List<String> topicTags
    ) {
        try {
            if (query != null && !query.isBlank() && properties.isQdrantEnabled()) {
                List<Double> vector = memoryEmbeddingClient.embed(query.trim());
                List<MemoryQdrantClient.SearchHit> hits = memoryQdrantClient.searchMemory(
                        tenantId,
                        appId,
                        userId,
                        vector,
                        topK,
                        minScore,
                        timelineRoots,
                        topicTags
                );
                if (!hits.isEmpty()) {
                    return enrichHits(tenantId, appId, userId, hits);
                }
            }
        } catch (Exception ignored) {
            // Fall through to PG lexical fallback to keep local/dev flow available.
        }
        return fallbackRetrieveMemoryItems(tenantId, appId, userId, query, topK, timelineRoots, topicTags);
    }

    private List<RetrievedMemoryFragmentView> enrichHits(
            String tenantId,
            String appId,
            String userId,
            List<MemoryQdrantClient.SearchHit> hits
    ) {
        List<String> ids = hits.stream().map(MemoryQdrantClient.SearchHit::fragmentId).toList();
        Map<String, MemoryFragmentDO> fragmentMap = memoryFragmentRepository.findByIds(tenantId, appId, userId, ids).stream()
                .collect(Collectors.toMap(MemoryFragmentDO::getId, item -> item));
        List<RetrievedMemoryFragmentView> items = new ArrayList<>();
        for (MemoryQdrantClient.SearchHit hit : hits) {
            MemoryFragmentDO fragment = fragmentMap.get(hit.fragmentId());
            if (fragment == null) {
                continue;
            }
            items.add(new RetrievedMemoryFragmentView(
                    fragment.getId(),
                    buildTitle(fragment.getContentText()),
                    fragment.getContentText(),
                    hit.score(),
                    splitTags(fragment.getTopicTags()),
                    splitTags(fragment.getEmotionTags())
            ));
        }
        return items;
    }

    private List<RetrievedMemoryFragmentView> fallbackRetrieveMemoryItems(
            String tenantId,
            String appId,
            String userId,
            String query,
            int topK,
            List<String> timelineRoots,
            List<String> topicTags
    ) {
        List<MemoryFragmentDO> fragments = memoryFragmentRepository.findLatestSearchableFragments(
                tenantId,
                appId,
                userId,
                Math.max(topK * 4, topK)
        );
        return fragments.stream()
                .filter(fragment -> timelineRoots == null || timelineRoots.isEmpty() || timelineRoots.contains(fragment.getTimelineRoot()))
                .filter(fragment -> topicTags == null || topicTags.isEmpty() || matchesAnyTag(fragment.getTopicTags(), topicTags))
                .map(fragment -> new RetrievedMemoryFragmentView(
                        fragment.getId(),
                        buildTitle(fragment.getContentText()),
                        fragment.getContentText(),
                        computeSimilarity(query == null ? "" : query, fragment.getContentText()),
                        splitTags(fragment.getTopicTags()),
                        splitTags(fragment.getEmotionTags())
                ))
                .sorted(Comparator.comparingDouble(RetrievedMemoryFragmentView::score).reversed())
                .limit(topK)
                .toList();
    }

    private MemoryFragmentView toFragmentView(MemoryFragmentDO fragment) {
        return new MemoryFragmentView(
                fragment.getId(),
                fragment.getTimelineRoot(),
                fragment.getContentText(),
                fragment.isSearchable(),
                defaultIfBlank(fragment.getFragmentType(), "EVENT"),
                defaultIfBlank(fragment.getVisibility(), "PRIVATE"),
                defaultIfBlank(fragment.getTimeBucket(), "today"),
                splitTags(fragment.getTopicTags()),
                splitTags(fragment.getEmotionTags()),
                safeChunkSeq(fragment),
                safeChunkConfidence(fragment),
                defaultIfBlank(fragment.getChunkStrategy(), "LOCAL_FALLBACK"),
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

    private MemoryRecallHitView toPreviewHit(RetrievedMemoryFragmentView item) {
        return new MemoryRecallHitView(
                item.fragmentId(),
                item.title(),
                item.score(),
                inferTimelineBucket(item.topicTags())
        );
    }

    private List<String> buildTags(MemoryFragmentDO fragment) {
        List<String> tags = new ArrayList<>();
        tags.add(fragment.getTimelineRoot());
        if (fragment.getFragmentType() != null && !fragment.getFragmentType().isBlank()) {
            tags.add(fragment.getFragmentType());
        }
        if (fragment.isSearchable()) {
            tags.add("SEARCHABLE");
        }
        tags.addAll(splitTags(fragment.getTopicTags()));
        tags.addAll(splitTags(fragment.getEmotionTags()));
        if (tags.size() > 8) {
            return tags.subList(0, 8);
        }
        return tags;
    }

    private String buildPairKey(String left, String right) {
        return left.compareTo(right) <= 0 ? left + "::" + right : right + "::" + left;
    }

    private double computeSimilarity(String left, String right) {
        String normalizedLeft = normalizeForSimilarity(left);
        String normalizedRight = normalizeForSimilarity(right);
        if (normalizedLeft.isBlank() || normalizedRight.isBlank()) {
            return 0d;
        }
        Set<String> leftTokens = toTokenSet(normalizedLeft);
        Set<String> rightTokens = toTokenSet(normalizedRight);
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) {
            return 0d;
        }
        int intersection = 0;
        for (String token : leftTokens) {
            if (rightTokens.contains(token)) {
                intersection += 1;
            }
        }
        return (double) intersection / (double) Math.max(leftTokens.size(), rightTokens.size());
    }

    private Set<String> toTokenSet(String normalized) {
        Set<String> tokens = new HashSet<>();
        for (int index = 0; index < normalized.length(); index += 1) {
            tokens.add(String.valueOf(normalized.charAt(index)));
            if (index + 1 < normalized.length()) {
                tokens.add(normalized.substring(index, index + 2));
            }
        }
        return tokens;
    }

    private String normalizeForSimilarity(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\u4e00-\\u9fa5]+", "");
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

    private List<String> normalizeTimelineRoots(List<String> timelineRoots) {
        if (timelineRoots == null || timelineRoots.isEmpty()) {
            return List.of();
        }
        return timelineRoots.stream()
                .map(this::normalizeTimelineRoot)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }
        return tags.stream()
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .distinct()
                .limit(6)
                .toList();
    }

    private List<String> splitTags(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(value.split("\\|"))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .distinct()
                .limit(6)
                .toList();
    }

    private int safeChunkSeq(MemoryFragmentDO fragment) {
        return fragment.getChunkSeq() == null || fragment.getChunkSeq() < 1 ? 1 : fragment.getChunkSeq();
    }

    private double safeChunkConfidence(MemoryFragmentDO fragment) {
        if (fragment.getChunkConfidence() == null) {
            return 0.5d;
        }
        return Math.max(0.01d, Math.min(fragment.getChunkConfidence(), 0.99d));
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private boolean matchesAnyTag(String serializedTags, List<String> expectedTags) {
        if (serializedTags == null || serializedTags.isBlank()) {
            return false;
        }
        List<String> current = splitTags(serializedTags);
        for (String expectedTag : expectedTags) {
            if (current.contains(expectedTag)) {
                return true;
            }
        }
        return false;
    }

    private String inferTimelineBucket(List<String> topicTags) {
        if (topicTags == null || topicTags.isEmpty()) {
            return "memory";
        }
        return topicTags.get(0);
    }

    private record PeerCandidate(MemoryFragmentDO fragment, double score) {
    }
}
