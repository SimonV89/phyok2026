package com.phyok.memory.application.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phyok.memory.application.config.MemoryProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class SemanticChunkService {
    private static final Logger log = LoggerFactory.getLogger(SemanticChunkService.class);
    private static final String ATTACHMENT_PLACEHOLDER = "请结合我上传的内容继续。";
    private static final Set<String> TIMELINE_ROOTS = Set.of("EARLY", "CHILDHOOD", "STUDENT", "WORK", "TODAY");
    private static final Set<String> FRAGMENT_TYPES = Set.of("FACT", "EVENT", "RELATION", "EMOTION");
    private static final String VISIBILITY_PRIVATE = "PRIVATE";
    private static final Map<String, List<String>> TOPIC_KEYWORDS = Map.of(
            "原生家庭", List.of("父母", "妈妈", "母亲", "爸爸", "父亲", "家庭", "原生家庭", "小时候", "童年"),
            "亲密关系", List.of("伴侣", "亲密关系", "恋爱", "分手", "喜欢的人", "被抛弃", "依恋"),
            "被忽视", List.of("不理我", "忽视", "冷暴力", "被看见", "被丢下"),
            "自我价值", List.of("不值得", "失败", "自我怀疑", "自卑", "羞耻"),
            "职场压力", List.of("工作", "老板", "同事", "职场", "项目", "加班"),
            "学业压力", List.of("考试", "学校", "老师", "同学", "成绩", "校园"),
            "边界", List.of("边界", "讨好", "拒绝", "迎合", "控制"),
            "安全感", List.of("安全感", "失联", "离开", "断掉", "稳定")
    );
    private static final Map<String, List<String>> EMOTION_KEYWORDS = Map.of(
            "害怕", List.of("害怕", "怕", "恐惧", "担心"),
            "不安", List.of("不安", "慌", "悬着", "紧张"),
            "焦虑", List.of("焦虑", "焦灼", "压得喘不过气"),
            "委屈", List.of("委屈", "难受", "心酸"),
            "愤怒", List.of("愤怒", "生气", "火大", "愤懑"),
            "羞耻", List.of("羞耻", "丢脸", "见不得人"),
            "孤独", List.of("孤独", "一个人", "没人懂"),
            "悲伤", List.of("悲伤", "难过", "伤心", "失落"),
            "压抑", List.of("压抑", "憋着", "忍着", "窒息")
    );

    private final MemoryProperties memoryProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public SemanticChunkService(MemoryProperties memoryProperties, ObjectMapper objectMapper) {
        this.memoryProperties = memoryProperties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(memoryProperties.getSemanticChunkTimeoutMs(), 1_000)))
                .build();
    }

    public List<ChunkCandidate> chunkForCreate(String contentText, String requestedTimelineRoot) {
        String normalizedText = normalizeInput(contentText);
        String normalizedTimelineRoot = normalizeTimelineRoot(requestedTimelineRoot);
        if (!memoryProperties.isSemanticChunkEnabled()
                || !llmReady()
                || normalizedText.length() < memoryProperties.getSemanticChunkLlmThresholdChars()) {
            return buildFallbackChunks(normalizedText, normalizedTimelineRoot, "LOCAL_FALLBACK");
        }
        try {
            List<ChunkCandidate> llmChunks = callLlmChunking(normalizedText, normalizedTimelineRoot);
            if (!llmChunks.isEmpty()) {
                return llmChunks;
            }
        } catch (Exception exception) {
            log.warn("Semantic chunking via LLM failed, falling back to local strategy.", exception);
        }
        return buildFallbackChunks(normalizedText, normalizedTimelineRoot, "LOCAL_FALLBACK");
    }

    public ChunkCandidate buildSingleChunkMetadata(String contentText, String requestedTimelineRoot, String strategy) {
        String normalizedText = normalizeInput(contentText);
        String normalizedTimelineRoot = normalizeTimelineRoot(requestedTimelineRoot);
        return new ChunkCandidate(
                1,
                normalizedText,
                inferFragmentType(normalizedText),
                normalizedTimelineRoot != null ? normalizedTimelineRoot : inferTimelineRoot(normalizedText),
                inferTopicTags(normalizedText),
                inferEmotionTags(normalizedText),
                "MANUAL_UPDATE".equals(strategy) ? 0.72d : 0.52d,
                strategy,
                VISIBILITY_PRIVATE,
                inferTimeBucket(normalizedTimelineRoot != null ? normalizedTimelineRoot : inferTimelineRoot(normalizedText))
        );
    }

    private List<ChunkCandidate> callLlmChunking(String contentText, String requestedTimelineRoot) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(buildCompletionsUrl()))
                .timeout(Duration.ofMillis(Math.max(memoryProperties.getSemanticChunkTimeoutMs(), 1_000)))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + memoryProperties.getSemanticChunkApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(writeRequestBody(contentText, requestedTimelineRoot), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Semantic chunking request failed, status=" + response.statusCode());
        }
        JsonNode root = objectMapper.readTree(response.body());
        String rawContent = readAssistantContent(root.path("choices").path(0).path("message").path("content"));
        if (rawContent.isBlank()) {
            throw new IllegalStateException("Semantic chunking response is empty.");
        }
        JsonNode chunkRoot = objectMapper.readTree(extractJson(rawContent));
        JsonNode chunksNode = chunkRoot.path("chunks");
        if (!chunksNode.isArray() || chunksNode.isEmpty()) {
            throw new IllegalStateException("Semantic chunking response has no chunks.");
        }

        List<ChunkCandidate> normalized = new ArrayList<>();
        for (JsonNode chunkNode : chunksNode) {
            String chunkContent = normalizeChunkContent(chunkNode.path("content").asText(""));
            if (chunkContent.isBlank()) {
                continue;
            }
            String timelineRoot = normalizeTimelineRoot(chunkNode.path("timelineRoot").asText(""));
            if (timelineRoot == null) {
                timelineRoot = requestedTimelineRoot != null ? requestedTimelineRoot : inferTimelineRoot(chunkContent);
            }
            String fragmentType = normalizeFragmentType(chunkNode.path("fragmentType").asText(""));
            if (fragmentType == null) {
                fragmentType = inferFragmentType(chunkContent);
            }
            List<String> topicTags = normalizeTags(readTags(chunkNode.path("topicTags")), inferTopicTags(chunkContent));
            List<String> emotionTags = normalizeTags(readTags(chunkNode.path("emotionTags")), inferEmotionTags(chunkContent));
            double confidence = clampConfidence(chunkNode.path("confidence").asDouble(0.82d), 0.82d);
            normalized.add(new ChunkCandidate(
                    normalized.size() + 1,
                    chunkContent,
                    fragmentType,
                    timelineRoot,
                    topicTags,
                    emotionTags,
                    confidence,
                    "LLM_SEMANTIC",
                    VISIBILITY_PRIVATE,
                    inferTimeBucket(timelineRoot)
            ));
        }
        return rebalanceChunks(normalized, requestedTimelineRoot, "LLM_SEMANTIC_REPAIRED");
    }

    private List<ChunkCandidate> buildFallbackChunks(String contentText, String requestedTimelineRoot, String strategy) {
        List<String> units = splitIntoSemanticUnits(contentText);
        List<String> chunkContents = packUnits(units);
        List<ChunkCandidate> chunks = new ArrayList<>();
        for (String chunkContent : chunkContents) {
            String timelineRoot = requestedTimelineRoot != null ? requestedTimelineRoot : inferTimelineRoot(chunkContent);
            chunks.add(new ChunkCandidate(
                    chunks.size() + 1,
                    chunkContent,
                    inferFragmentType(chunkContent),
                    timelineRoot,
                    inferTopicTags(chunkContent),
                    inferEmotionTags(chunkContent),
                    "LOCAL_FALLBACK".equals(strategy) ? 0.52d : 0.64d,
                    strategy,
                    VISIBILITY_PRIVATE,
                    inferTimeBucket(timelineRoot)
            ));
        }
        return rebalanceChunks(chunks, requestedTimelineRoot, strategy);
    }

    private List<ChunkCandidate> rebalanceChunks(List<ChunkCandidate> chunks, String requestedTimelineRoot, String repairedStrategy) {
        if (chunks.isEmpty()) {
            return List.of(buildSingleChunkMetadata("待补充记忆内容", requestedTimelineRoot, "LOCAL_FALLBACK"));
        }

        List<ChunkCandidate> expanded = new ArrayList<>();
        for (ChunkCandidate chunk : chunks) {
            if (chunk.content().length() <= memoryProperties.getSemanticChunkMaxChars()) {
                expanded.add(chunk);
                continue;
            }
            List<ChunkCandidate> fallbackPieces = buildFallbackChunks(chunk.content(), chunk.timelineRoot(), repairedStrategy);
            for (ChunkCandidate piece : fallbackPieces) {
                expanded.add(new ChunkCandidate(
                        expanded.size() + 1,
                        piece.content(),
                        chunk.fragmentType(),
                        piece.timelineRoot(),
                        normalizeTags(chunk.topicTags(), inferTopicTags(piece.content())),
                        normalizeTags(chunk.emotionTags(), inferEmotionTags(piece.content())),
                        Math.max(0.42d, chunk.chunkConfidence() - 0.12d),
                        repairedStrategy,
                        chunk.visibility(),
                        inferTimeBucket(piece.timelineRoot())
                ));
            }
        }

        List<ChunkCandidate> merged = new ArrayList<>();
        for (ChunkCandidate chunk : expanded) {
            if (!merged.isEmpty() && chunk.content().length() < memoryProperties.getSemanticChunkMinChars()) {
                ChunkCandidate previous = merged.remove(merged.size() - 1);
                String mergedContent = previous.content() + "\n" + chunk.content();
                merged.add(new ChunkCandidate(
                        previous.seq(),
                        mergedContent,
                        previous.fragmentType(),
                        previous.timelineRoot(),
                        normalizeTags(joinTags(previous.topicTags(), chunk.topicTags()), inferTopicTags(mergedContent)),
                        normalizeTags(joinTags(previous.emotionTags(), chunk.emotionTags()), inferEmotionTags(mergedContent)),
                        clampConfidence(Math.min(previous.chunkConfidence(), chunk.chunkConfidence()), 0.56d),
                        repairedStrategy.equals(previous.chunkStrategy()) ? previous.chunkStrategy() : repairedStrategy,
                        previous.visibility(),
                        inferTimeBucket(previous.timelineRoot())
                ));
                continue;
            }
            merged.add(chunk);
        }

        int maxChunks = Math.max(memoryProperties.getSemanticChunkMaxChunks(), 1);
        if (merged.size() > maxChunks) {
            List<ChunkCandidate> collapsed = new ArrayList<>();
            int groupSize = (int) Math.ceil((double) merged.size() / (double) maxChunks);
            for (int index = 0; index < merged.size(); index += groupSize) {
                List<ChunkCandidate> group = merged.subList(index, Math.min(index + groupSize, merged.size()));
                String combinedContent = group.stream().map(ChunkCandidate::content).reduce((left, right) -> left + "\n" + right).orElse("");
                ChunkCandidate first = group.get(0);
                collapsed.add(new ChunkCandidate(
                        collapsed.size() + 1,
                        combinedContent,
                        first.fragmentType(),
                        first.timelineRoot(),
                        normalizeTags(group.stream().flatMap(item -> item.topicTags().stream()).toList(), inferTopicTags(combinedContent)),
                        normalizeTags(group.stream().flatMap(item -> item.emotionTags().stream()).toList(), inferEmotionTags(combinedContent)),
                        clampConfidence(group.stream().mapToDouble(ChunkCandidate::chunkConfidence).average().orElse(0.58d), 0.58d),
                        repairedStrategy,
                        first.visibility(),
                        inferTimeBucket(first.timelineRoot())
                ));
            }
            merged = collapsed;
        }

        List<ChunkCandidate> finalized = new ArrayList<>();
        for (ChunkCandidate chunk : merged) {
            String timelineRoot = normalizeTimelineRoot(chunk.timelineRoot());
            timelineRoot = timelineRoot != null ? timelineRoot : (requestedTimelineRoot != null ? requestedTimelineRoot : inferTimelineRoot(chunk.content()));
            finalized.add(new ChunkCandidate(
                    finalized.size() + 1,
                    normalizeChunkContent(chunk.content()),
                    normalizeFragmentType(chunk.fragmentType()) != null ? chunk.fragmentType() : inferFragmentType(chunk.content()),
                    timelineRoot,
                    normalizeTags(chunk.topicTags(), inferTopicTags(chunk.content())),
                    normalizeTags(chunk.emotionTags(), inferEmotionTags(chunk.content())),
                    clampConfidence(chunk.chunkConfidence(), 0.58d),
                    chunk.chunkStrategy(),
                    VISIBILITY_PRIVATE,
                    inferTimeBucket(timelineRoot)
            ));
        }
        return finalized;
    }

    private List<String> packUnits(List<String> units) {
        List<String> chunks = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int preferredChunkChars = Math.max(memoryProperties.getSemanticChunkMinChars() + 28, memoryProperties.getSemanticChunkMaxChars() - 44);
        for (String unit : units) {
            String safeUnit = unit.trim();
            if (safeUnit.isBlank()) {
                continue;
            }
            if (current.length() > 0
                    && (current.length() + 1 + safeUnit.length() > memoryProperties.getSemanticChunkMaxChars()
                    || (current.length() >= preferredChunkChars && safeUnit.length() >= Math.max(memoryProperties.getSemanticChunkMinChars() / 2, 24)))) {
                chunks.add(current.toString().trim());
                current = new StringBuilder();
            }
            if (current.length() > 0) {
                current.append('\n');
            }
            current.append(safeUnit);
        }
        if (current.length() > 0) {
            if (!chunks.isEmpty()
                    && current.length() < memoryProperties.getSemanticChunkMinChars()
                    && chunks.get(chunks.size() - 1).length() + 1 + current.length() <= memoryProperties.getSemanticChunkMaxChars() + 80) {
                String last = chunks.remove(chunks.size() - 1);
                chunks.add(last + "\n" + current);
            } else {
                chunks.add(current.toString().trim());
            }
        }
        return chunks.isEmpty() ? List.of("待补充记忆内容") : chunks;
    }

    private List<String> splitIntoSemanticUnits(String contentText) {
        List<String> units = new ArrayList<>();
        String[] paragraphs = contentText.replace("\r\n", "\n").split("\\n{2,}");
        for (String paragraph : paragraphs) {
            String normalizedParagraph = paragraph.trim().replaceAll("\\s+", " ");
            if (normalizedParagraph.isBlank()) {
                continue;
            }
            String[] sentences = normalizedParagraph.split("(?<=[。！？!?；;])\\s*");
            for (String sentence : sentences) {
                String safeSentence = sentence.trim();
                if (safeSentence.isBlank()) {
                    continue;
                }
                if (shouldSplitNarrativeSentence(safeSentence)) {
                    units.addAll(splitLongSentence(safeSentence));
                } else {
                    units.add(safeSentence);
                }
            }
        }
        return units.isEmpty() ? List.of("待补充记忆内容") : units;
    }

    private List<String> splitLongSentence(String sentence) {
        List<String> pieces = new ArrayList<>();
        String[] segments = sentence.split("(?<=[，、：,:])\\s*|(?<=，)(?=但|可是|不过|后来|然后|于是|结果|反而|同时|那时|当时|直到|忽然|突然|慢慢地|渐渐|非常|特别|记得|记忆深刻|印象很深)");
        StringBuilder current = new StringBuilder();
        int preferredChunkChars = Math.max(memoryProperties.getSemanticChunkMinChars() + 18, memoryProperties.getSemanticChunkMaxChars() - 72);
        for (String segment : segments) {
            String safeSegment = segment.trim();
            if (safeSegment.isBlank()) {
                continue;
            }
            if (current.length() > 0
                    && (current.length() + safeSegment.length() > memoryProperties.getSemanticChunkMaxChars()
                    || (current.length() >= preferredChunkChars && shouldStartNewPiece(safeSegment)))) {
                pieces.add(current.toString().trim());
                current = new StringBuilder();
            }
            if (current.length() > 0) {
                current.append(' ');
            }
            current.append(safeSegment);
        }
        if (current.length() > 0) {
            pieces.add(current.toString().trim());
        }
        if (pieces.isEmpty()) {
            return hardSplit(sentence);
        }
        if (pieces.size() == 1 && pieces.get(0).length() > memoryProperties.getSemanticChunkMaxChars()) {
            return hardSplit(pieces.get(0));
        }
        return pieces;
    }

    private boolean shouldSplitNarrativeSentence(String sentence) {
        if (sentence.length() > memoryProperties.getSemanticChunkMaxChars()) {
            return true;
        }
        if (sentence.length() < Math.max(memoryProperties.getSemanticChunkMinChars(), 42)) {
            return false;
        }
        return countNarrativeDelimiters(sentence) >= 4 || containsNarrativeShift(sentence);
    }

    private int countNarrativeDelimiters(String sentence) {
        int count = 0;
        for (int index = 0; index < sentence.length(); index += 1) {
            char current = sentence.charAt(index);
            if (current == '，' || current == '、' || current == ',' || current == '：' || current == ':') {
                count += 1;
            }
        }
        return count;
    }

    private boolean containsNarrativeShift(String sentence) {
        return containsKeywords(sentence, List.of("但是", "可是", "不过", "后来", "然后", "于是", "结果", "反而", "同时", "直到", "突然", "忽然", "非常", "特别", "记忆深刻", "印象很深"));
    }

    private boolean shouldStartNewPiece(String segment) {
        return containsKeywords(segment, List.of("但是", "可是", "不过", "后来", "然后", "于是", "结果", "反而", "同时", "那时", "当时", "直到", "忽然", "突然", "嗯", "记忆深刻", "印象很深", "非常", "特别"));
    }

    private String writeRequestBody(String contentText, String requestedTimelineRoot) throws IOException {
        String systemPrompt = """
                你是心理叙事语义分片器。你的唯一任务是把一段中文心理叙事文本按自然语义边界切成多个 chunk。
                你必须只输出一个 JSON 对象，不得输出 markdown，不得输出解释文字。
                JSON 格式固定为 {"chunks":[...]}。
                每个 chunk 必须包含：
                - seq: 正整数，从 1 开始
                - content: chunk 正文，必须保留原意，不得改写成立场性总结
                - fragmentType: 只能是 FACT / EVENT / RELATION / EMOTION 之一
                - timelineRoot: 只能是 EARLY / CHILDHOOD / STUDENT / WORK / TODAY 之一
                - topicTags: 字符串数组，最多 4 个
                - emotionTags: 字符串数组，最多 4 个
                - confidence: 0 到 1 之间的小数
                分片要求：
                - 按自然语义边界切分，不要机械按长度切
                - 不要把明显不同时间段、情绪转折、关系模式硬混在一个 chunk
                - 不要输出超过 6 个 chunk
                - 单个 chunk 尽量简洁但完整
                """;
        String userPrompt = """
                请对下面文本做自然语义分片。
                如果文本整体只有一个清晰语义单元，也可以只返回 1 个 chunk。
                优先参考文本本身判断 timelineRoot；如果拿不准，再参考请求提供的 timelineRoot。

                请求 timelineRoot：
                %s

                原文：
                %s
                """.formatted(requestedTimelineRoot == null ? "(未提供)" : requestedTimelineRoot, contentText);

        return objectMapper.writeValueAsString(Map.of(
                "model", memoryProperties.getSemanticChunkModel(),
                "temperature", 0.2,
                "max_tokens", 1200,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userPrompt)
                )
        ));
    }

    private String buildCompletionsUrl() {
        String baseUrl = memoryProperties.getSemanticChunkBaseUrl();
        if (baseUrl.endsWith("/")) {
            return baseUrl + "chat/completions";
        }
        return baseUrl + "/chat/completions";
    }

    private String readAssistantContent(JsonNode contentNode) {
        if (contentNode.isTextual()) {
            return contentNode.asText("");
        }
        if (contentNode.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode node : contentNode) {
                if (node.path("type").asText("").equals("text")) {
                    builder.append(node.path("text").asText(""));
                }
            }
            return builder.toString();
        }
        return "";
    }

    private String extractJson(String rawContent) {
        int start = rawContent.indexOf('{');
        int end = rawContent.lastIndexOf('}');
        if (start < 0 || end < start) {
            throw new IllegalStateException("Semantic chunking response does not contain JSON.");
        }
        return rawContent.substring(start, end + 1);
    }

    private boolean llmReady() {
        return !memoryProperties.getSemanticChunkApiKey().isBlank()
                && !memoryProperties.getSemanticChunkBaseUrl().isBlank()
                && !memoryProperties.getSemanticChunkModel().isBlank();
    }

    private String normalizeInput(String contentText) {
        if (contentText == null || contentText.isBlank()) {
            return "待补充记忆内容";
        }
        String normalized = contentText
                .replace("\r\n", "\n")
                .replaceAll("[\\t\\x0B\\f]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
        if (normalized.equals(ATTACHMENT_PLACEHOLDER)) {
            return "待补充记忆内容";
        }
        normalized = normalized.replaceFirst("^请结合我上传的内容继续。\\s*", "");
        normalized = normalized.replaceFirst("^附件(?:补充|内容)[:：]\\s*", "");
        return normalized.isBlank() ? "待补充记忆内容" : normalized;
    }

    private String normalizeChunkContent(String contentText) {
        if (contentText == null || contentText.isBlank()) {
            return "";
        }
        return contentText
                .replace("\r\n", "\n")
                .replaceAll("[\\t\\x0B\\f]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }

    private String normalizeTimelineRoot(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return TIMELINE_ROOTS.contains(normalized) ? normalized : null;
    }

    private String normalizeFragmentType(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return FRAGMENT_TYPES.contains(normalized) ? normalized : null;
    }

    private String inferTimelineRoot(String contentText) {
        String normalized = contentText.toLowerCase(Locale.ROOT);
        if (normalized.contains("幼年") || normalized.contains("婴儿") || normalized.contains("很小")) {
            return "EARLY";
        }
        if (normalized.contains("小时候")
                || normalized.contains("童年")
                || normalized.contains("妈妈")
                || normalized.contains("父母")
                || normalized.contains("原生家庭")) {
            return "CHILDHOOD";
        }
        if (normalized.contains("学生")
                || normalized.contains("学校")
                || normalized.contains("考试")
                || normalized.contains("大学")
                || normalized.contains("高中")) {
            return "STUDENT";
        }
        if (normalized.contains("工作")
                || normalized.contains("同事")
                || normalized.contains("老板")
                || normalized.contains("公司")
                || normalized.contains("职场")) {
            return "WORK";
        }
        return "TODAY";
    }

    private String inferFragmentType(String contentText) {
        String normalized = contentText.toLowerCase(Locale.ROOT);
        if (containsKeywords(normalized, List.of("害怕", "焦虑", "羞耻", "愤怒", "委屈", "孤独", "悲伤", "不安"))) {
            return "EMOTION";
        }
        if (containsKeywords(normalized, List.of("关系", "伴侣", "父母", "妈妈", "爸爸", "同事", "朋友"))) {
            return "RELATION";
        }
        if (containsKeywords(normalized, List.of("那次", "后来", "当时", "突然", "有一天", "之后", "一直"))) {
            return "EVENT";
        }
        return "FACT";
    }

    private String inferTimeBucket(String timelineRoot) {
        return switch (timelineRoot == null ? "TODAY" : timelineRoot) {
            case "EARLY" -> "early";
            case "CHILDHOOD" -> "childhood";
            case "STUDENT" -> "student";
            case "WORK" -> "work";
            default -> "today";
        };
    }

    private List<String> inferTopicTags(String contentText) {
        String normalized = contentText.toLowerCase(Locale.ROOT);
        List<String> tags = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : TOPIC_KEYWORDS.entrySet()) {
            if (containsKeywords(normalized, entry.getValue())) {
                tags.add(entry.getKey());
            }
        }
        if (tags.isEmpty()) {
            tags.add("个人叙事");
        }
        return tags.stream().limit(4).toList();
    }

    private List<String> inferEmotionTags(String contentText) {
        String normalized = contentText.toLowerCase(Locale.ROOT);
        List<String> tags = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : EMOTION_KEYWORDS.entrySet()) {
            if (containsKeywords(normalized, entry.getValue())) {
                tags.add(entry.getKey());
            }
        }
        return tags.stream().limit(4).toList();
    }

    private List<String> readTags(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual()) {
                values.add(item.asText(""));
            }
        }
        return values;
    }

    private List<String> normalizeTags(List<String> rawTags, List<String> fallbackTags) {
        List<String> source = (rawTags == null || rawTags.isEmpty()) ? fallbackTags : rawTags;
        LinkedHashSet<String> tags = new LinkedHashSet<>();
        for (String raw : source) {
            if (raw == null) {
                continue;
            }
            String normalized = raw.trim();
            if (!normalized.isBlank()) {
                tags.add(normalized);
            }
            if (tags.size() >= 6) {
                break;
            }
        }
        if (tags.isEmpty() && fallbackTags != null) {
            tags.addAll(fallbackTags);
        }
        return List.copyOf(tags);
    }

    private List<String> joinTags(List<String> left, List<String> right) {
        List<String> tags = new ArrayList<>();
        if (left != null) {
            tags.addAll(left);
        }
        if (right != null) {
            tags.addAll(right);
        }
        return tags;
    }

    private double clampConfidence(double value, double fallback) {
        if (Double.isNaN(value) || value <= 0d) {
            return fallback;
        }
        return Math.max(0.01d, Math.min(value, 0.99d));
    }

    private List<String> hardSplit(String contentText) {
        int window = Math.max(memoryProperties.getSemanticChunkMaxChars(), 80);
        List<String> pieces = new ArrayList<>();
        for (int start = 0; start < contentText.length(); start += window) {
            int end = Math.min(start + window, contentText.length());
            pieces.add(contentText.substring(start, end).trim());
        }
        return pieces.isEmpty() ? List.of(contentText) : pieces;
    }

    private boolean containsKeywords(String contentText, List<String> keywords) {
        for (String keyword : keywords) {
            if (contentText.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    public record ChunkCandidate(
            int seq,
            String content,
            String fragmentType,
            String timelineRoot,
            List<String> topicTags,
            List<String> emotionTags,
            double chunkConfidence,
            String chunkStrategy,
            String visibility,
            String timeBucket
    ) {
    }
}
