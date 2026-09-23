"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchMemoryStarMap, type MemoryStarMapResponse } from "@/lib/chat-api";

type MemoryMapView = "all" | "early" | "childhood" | "student" | "work" | "today";
type TimelineKey = "early" | "childhood" | "student" | "work" | "current";
type MemoryNode = {
  id: string;
  kind: "root" | "memory";
  timeline: TimelineKey;
  label: string;
  text?: string | null;
  similarity?: number | null;
  sourceType?: string;
  conversationId?: string | null;
  tags?: string[];
  updatedAt?: number | null;
  peerCount?: number;
  clusterId?: string;
  x?: number;
  y?: number;
  z?: number;
};
type MemoryLink = {
  source: string;
  target: string;
  kind: "root" | "peer";
  similarity: number;
};

type MemoryStarMapPanelProps = {
  currentConversationId: string | null;
  currentUserId?: string | null;
  refreshKey?: number;
  onOpenConversation?: (conversationId: string) => void | Promise<void>;
};

const ROOT_ORDER: TimelineKey[] = ["early", "childhood", "student", "work", "current"];
const VIEW_LABELS: Record<MemoryMapView, string> = {
  all: "全部",
  early: "幼年",
  childhood: "童年",
  student: "学生",
  work: "工作",
  today: "当下"
};
const ROOT_LABELS: Record<TimelineKey, string> = {
  early: "幼年",
  childhood: "童年",
  student: "学生",
  work: "工作",
  current: "当下"
};
const TIMELINE_COLORS: Record<TimelineKey, string> = {
  early: "#f59e0b",
  childhood: "#0ea5e9",
  student: "#6366f1",
  work: "#10b981",
  current: "#ef4444"
};
const STAR_EMOJIS = ["✨", "💫", "🌠", "☄️", "🔆"];
const PLANET_EMOJI = "🪐";
const MIN_SCALE = 0.72;
const MAX_SCALE = 1.84;
const INITIAL_CAMERA = { scale: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashText(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function trimLabel(input: string, maxChars: number): string {
  const safeInput = input.trim();
  const chars = Array.from(safeInput);
  if (chars.length <= maxChars) {
    return safeInput;
  }
  return `${chars.slice(0, maxChars).join("")}…`;
}

function nodeEmoji(node: MemoryNode): string {
  if (node.kind === "root") {
    return PLANET_EMOJI;
  }
  return STAR_EMOJIS[hashText(node.id) % STAR_EMOJIS.length];
}

function rootPositions(
  width: number,
  height: number,
  activeTimeline?: TimelineKey
): Record<TimelineKey, { x: number; y: number }> {
  const centerX = width / 2;
  const centerY = height / 2;
  if (activeTimeline) {
    return ROOT_ORDER.reduce<Record<TimelineKey, { x: number; y: number }>>((acc, timeline) => {
      acc[timeline] =
        timeline === activeTimeline
          ? { x: centerX, y: centerY }
          : { x: -9999, y: -9999 };
      return acc;
    }, {} as Record<TimelineKey, { x: number; y: number }>);
  }

  const anchors: Array<{ x: number; y: number }> = [
    { x: 0.16, y: 0.34 },
    { x: 0.31, y: 0.67 },
    { x: 0.5, y: 0.26 },
    { x: 0.69, y: 0.63 },
    { x: 0.84, y: 0.37 }
  ];
  return ROOT_ORDER.reduce<Record<TimelineKey, { x: number; y: number }>>((acc, timeline, index) => {
    acc[timeline] = {
      x: Math.max(86, Math.min(width - 86, width * anchors[index].x)),
      y: Math.max(88, Math.min(height - 88, height * anchors[index].y))
    };
    return acc;
  }, {} as Record<TimelineKey, { x: number; y: number }>);
}

function parseTimeline(timelineRoot: MemoryStarMapResponse["data"]["nodes"][number]["timelineRoot"]): TimelineKey {
  switch (timelineRoot) {
    case "EARLY":
      return "early";
    case "CHILDHOOD":
      return "childhood";
    case "STUDENT":
      return "student";
    case "WORK":
      return "work";
    case "TODAY":
    default:
      return "current";
  }
}

function toBackendTimeline(view: MemoryMapView): MemoryStarMapResponse["data"]["nodes"][number]["timelineRoot"] | undefined {
  switch (view) {
    case "early":
      return "EARLY";
    case "childhood":
      return "CHILDHOOD";
    case "student":
      return "STUDENT";
    case "work":
      return "WORK";
    case "today":
      return "TODAY";
    default:
      return undefined;
  }
}

function sourceLabel(sourceType?: string): string {
  if (sourceType === "local-debug") {
    return "本地调试";
  }
  return "记忆依据";
}

function mapGraph(data: MemoryStarMapResponse["data"] | null): { nodes: MemoryNode[]; links: MemoryLink[]; totalMemories: number } {
  if (!data) {
    return {
      nodes: [],
      links: [],
      totalMemories: 0
    };
  }

  return {
    nodes: data.nodes.map((node) => ({
      id: node.id,
      kind: node.type,
      timeline: parseTimeline(node.timelineRoot),
      label: node.label,
      text: node.contentText,
      similarity: node.score,
      sourceType: node.sourceType,
      conversationId: node.conversationId,
      tags: node.tags,
      updatedAt: node.createdAt ? new Date(node.createdAt).getTime() : null
    })),
    links: data.links.map((link) => ({
      source: link.source,
      target: link.target,
      kind: link.type === "peer" ? "peer" : "root",
      similarity: link.score ?? 0.42
    })),
    totalMemories: data.totalMemories
  };
}

function buildGraphMetrics(nodes: MemoryNode[], links: MemoryLink[]) {
  const memoryNodeMap = new Map(nodes.filter((node) => node.kind === "memory").map((node) => [node.id, node]));
  const adjacency = new Map<string, Set<string>>();
  const degreeMap = new Map<string, number>();

  for (const nodeId of memoryNodeMap.keys()) {
    adjacency.set(nodeId, new Set());
    degreeMap.set(nodeId, 0);
  }

  for (const link of links) {
    if (link.kind !== "peer") {
      continue;
    }
    const source = memoryNodeMap.get(link.source);
    const target = memoryNodeMap.get(link.target);
    if (!source || !target || source.timeline !== target.timeline) {
      continue;
    }
    adjacency.get(source.id)?.add(target.id);
    adjacency.get(target.id)?.add(source.id);
    degreeMap.set(source.id, (degreeMap.get(source.id) ?? 0) + 1);
    degreeMap.set(target.id, (degreeMap.get(target.id) ?? 0) + 1);
  }

  const clusterByNode = new Map<string, string>();
  const visited = new Set<string>();

  for (const timeline of ROOT_ORDER) {
    const ids = [...memoryNodeMap.values()]
      .filter((node) => node.timeline === timeline)
      .map((node) => node.id)
      .sort();
    let clusterIndex = 0;

    for (const id of ids) {
      if (visited.has(id)) {
        continue;
      }
      const queue = [id];
      visited.add(id);
      const clusterId = `${timeline}-${clusterIndex}`;
      clusterIndex += 1;

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
          continue;
        }
        clusterByNode.set(current, clusterId);
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }

  return { degreeMap, clusterByNode };
}

function layoutNodes(
  nodes: MemoryNode[],
  links: MemoryLink[],
  width: number,
  height: number,
  use3d: boolean,
  view: MemoryMapView
): MemoryNode[] {
  const activeTimeline: TimelineKey | undefined = view === "all" ? undefined : view === "today" ? "current" : view;
  const rootMap = rootPositions(width, height, activeTimeline);
  const grouped = new Map<TimelineKey, MemoryNode[]>();
  const { degreeMap, clusterByNode } = buildGraphMetrics(nodes, links);

  for (const node of nodes) {
    if (node.kind === "memory") {
      const list = grouped.get(node.timeline) ?? [];
      list.push(node);
      grouped.set(node.timeline, list);
    }
  }

  const positionedMemories = new Map<string, MemoryNode>();
  for (const timeline of ROOT_ORDER) {
    const group = grouped.get(timeline) ?? [];
    if (group.length === 0) {
      continue;
    }

    const root = rootMap[timeline];
    const clusterMap = new Map<string, MemoryNode[]>();
    for (const node of group) {
      const clusterId = clusterByNode.get(node.id) ?? `${timeline}-solo-${node.id}`;
      const cluster = clusterMap.get(clusterId) ?? [];
      cluster.push(node);
      clusterMap.set(clusterId, cluster);
    }

    const clusters = [...clusterMap.entries()]
      .map(([clusterId, members]) => ({
        clusterId,
        members: members.slice().sort((left, right) => {
          const degreeDiff = (degreeMap.get(right.id) ?? 0) - (degreeMap.get(left.id) ?? 0);
          if (degreeDiff !== 0) {
            return degreeDiff;
          }
          return (right.similarity ?? 0) - (left.similarity ?? 0);
        })
      }))
      .sort((left, right) => right.members.length - left.members.length);

    const clusterCount = Math.max(clusters.length, 1);
    clusters.forEach(({ clusterId, members }, clusterIndex) => {
      const orbitLayer = Math.floor(clusterIndex / 5);
      const orbitSlots = Math.min(5, Math.max(clusterCount - orbitLayer * 5, 1));
      const orbitIndex = clusterIndex % 5;
      const orbitRadius = activeTimeline ? 138 + orbitLayer * 104 : 96 + orbitLayer * 76;
      const orbitAngle =
        -Math.PI / 2 +
        (orbitIndex * Math.PI * 2) / orbitSlots +
        (hashText(`${timeline}:${clusterId}`) % 360) * (Math.PI / 180) * 0.08;
      const clusterCenterX = root.x + Math.cos(orbitAngle) * orbitRadius;
      const clusterCenterY = root.y + Math.sin(orbitAngle) * orbitRadius * (activeTimeline ? 0.82 : 0.66);

      members.forEach((node, index) => {
        const ringSize = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(members.length + 1))));
        const ring = Math.floor(index / ringSize);
        const slot = index % ringSize;
        const degree = degreeMap.get(node.id) ?? 0;
        const baseRadius = members.length === 1 ? 0 : 24 + ring * 34 + (hashText(node.id) % 10);
        const radius = Math.max(0, baseRadius - Math.min(degree, 3) * 6);
        const angle =
          members.length === 1
            ? 0
            : (slot * Math.PI * 2) / ringSize +
              clusterIndex * 0.42 +
              (hashText(`${node.id}:angle`) % 360) * (Math.PI / 180) * 0.1;
        const depth = use3d ? (hashText(`${node.id}:z`) % 180) - 90 : 0;

        positionedMemories.set(node.id, {
          ...node,
          peerCount: degree,
          clusterId,
          x: clusterCenterX + Math.cos(angle) * radius,
          y: clusterCenterY + Math.sin(angle) * radius,
          z: depth
        });
      });
    });
  }

  return nodes.map((node) => {
    if (node.kind === "root") {
      const pin = rootMap[node.timeline];
      return {
        ...node,
        x: pin.x,
        y: pin.y,
        z: 0
      };
    }

    return positionedMemories.get(node.id) ?? node;
  });
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) {
    return `rgba(100, 116, 139, ${alpha})`;
  }
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatMemoryTime(timestamp?: number | null): string | null {
  if (!timestamp) {
    return null;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

export function MemoryStarMapPanel({
  currentConversationId,
  currentUserId,
  refreshKey = 0,
  onOpenConversation
}: MemoryStarMapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const touchGestureRef = useRef<
    | {
        mode: "pan";
        startX: number;
        startY: number;
        originX: number;
        originY: number;
      }
    | {
        mode: "pinch";
        startDistance: number;
        startScale: number;
        startCenterX: number;
        startCenterY: number;
      }
    | null
  >(null);
  const [viewKey, setViewKey] = useState<MemoryMapView>("all");
  const [use3d, setUse3d] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ width: 960, height: 620 });
  const [camera, setCamera] = useState(INITIAL_CAMERA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<MemoryStarMapResponse["data"] | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) {
        return;
      }
      setViewport({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(420, Math.floor(rect.height))
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void fetchMemoryStarMap({
      timelineRoot: toBackendTimeline(viewKey),
      limit: 180,
      userId: currentUserId ?? undefined
    })
      .then((data) => {
        if (!active) {
          return;
        }
        setGraphData(data);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "加载记忆星图失败。");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentConversationId, currentUserId, refreshKey, viewKey]);

  const graph = useMemo(() => mapGraph(graphData), [graphData]);
  const positionedNodes = useMemo(
    () => layoutNodes(graph.nodes, graph.links, viewport.width, viewport.height, use3d, viewKey),
    [graph.links, graph.nodes, use3d, viewKey, viewport.height, viewport.width]
  );
  const nodeMap = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const peerLinks = useMemo(() => graph.links.filter((link) => link.kind === "peer"), [graph.links]);
  const interactiveNodeId = hoveredNodeId ?? selectedNodeId;
  const selectedPeerLinks = useMemo(
    () =>
      selectedNode
        ? peerLinks.filter((link) => link.source === selectedNode.id || link.target === selectedNode.id)
        : [],
    [peerLinks, selectedNode]
  );
  const activeNodeNeighborhood = useMemo(() => {
    if (!interactiveNodeId) {
      return null;
    }
    const related = new Set<string>([interactiveNodeId]);
    for (const link of graph.links) {
      if (link.source === interactiveNodeId) {
        related.add(link.target);
      }
      if (link.target === interactiveNodeId) {
        related.add(link.source);
      }
    }
    return related;
  }, [graph.links, interactiveNodeId]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    if (!nodeMap.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodeMap, selectedNodeId]);

  const memoryNodes = positionedNodes.filter((node) => node.kind === "memory");
  const summaryText = loading ? "正在编织记忆星图…" : `${graph.totalMemories} 条记忆 · ${peerLinks.length} 条相似度连边`;
  const canvasStyle = useMemo(
    () =>
      ({
        transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`
      }) as CSSProperties,
    [camera.scale, camera.x, camera.y]
  );

  const updateCamera = (next: Partial<typeof INITIAL_CAMERA>) => {
    setCamera((current) => ({
      scale: next.scale == null ? current.scale : clamp(next.scale, MIN_SCALE, MAX_SCALE),
      x: next.x == null ? current.x : next.x,
      y: next.y == null ? current.y : next.y
    }));
  };

  const zoomAtPoint = (nextScaleRaw: number, clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const nextScale = clamp(nextScaleRaw, MIN_SCALE, MAX_SCALE);
    setCamera((current) => {
      if (!rect) {
        return { ...current, scale: nextScale };
      }
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const worldX = (localX - current.x) / current.scale;
      const worldY = (localY - current.y) / current.scale;
      return {
        scale: nextScale,
        x: localX - worldX * nextScale,
        y: localY - worldY * nextScale
      };
    });
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".memory-map-node, .memory-map-toolbar, .memory-map-status, .memory-map-detail")) {
      return;
    }
    dragPointerIdRef.current = event.pointerId;
    dragOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
      startX: camera.x,
      startY: camera.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== event.pointerId || !dragOriginRef.current) {
      return;
    }
    const deltaX = event.clientX - dragOriginRef.current.x;
    const deltaY = event.clientY - dragOriginRef.current.y;
    updateCamera({
      x: dragOriginRef.current.startX + deltaX,
      y: dragOriginRef.current.startY + deltaY
    });
  };

  const stopPointerDrag = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && dragPointerIdRef.current === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragPointerIdRef.current = null;
    dragOriginRef.current = null;
  };

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
      return;
    }
    event.preventDefault();
    const zoomDelta = event.deltaY > 0 ? -0.08 : 0.08;
    zoomAtPoint(camera.scale + zoomDelta, event.clientX, event.clientY);
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".memory-map-toolbar, .memory-map-status, .memory-map-detail")) {
      return;
    }
    if (event.touches.length === 2) {
      const [first, second] = [event.touches[0], event.touches[1]];
      touchGestureRef.current = {
        mode: "pinch",
        startDistance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        startScale: camera.scale,
        startCenterX: (first.clientX + second.clientX) / 2,
        startCenterY: (first.clientY + second.clientY) / 2
      };
      return;
    }
    if (event.touches.length === 1 && !(event.target as HTMLElement).closest(".memory-map-node")) {
      const touch = event.touches[0];
      touchGestureRef.current = {
        mode: "pan",
        startX: touch.clientX,
        startY: touch.clientY,
        originX: camera.x,
        originY: camera.y
      };
    }
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const gesture = touchGestureRef.current;
    if (!gesture) {
      return;
    }
    if (gesture.mode === "pinch" && event.touches.length === 2) {
      event.preventDefault();
      const [first, second] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
      const centerX = (first.clientX + second.clientX) / 2;
      const centerY = (first.clientY + second.clientY) / 2;
      const scaleRatio = distance / Math.max(gesture.startDistance, 1);
      zoomAtPoint(gesture.startScale * scaleRatio, centerX, centerY);
      return;
    }
    if (gesture.mode === "pan" && event.touches.length === 1) {
      event.preventDefault();
      const touch = event.touches[0];
      updateCamera({
        x: gesture.originX + (touch.clientX - gesture.startX),
        y: gesture.originY + (touch.clientY - gesture.startY)
      });
    }
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) {
      touchGestureRef.current = null;
      return;
    }
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchGestureRef.current = {
        mode: "pan",
        startX: touch.clientX,
        startY: touch.clientY,
        originX: camera.x,
        originY: camera.y
      };
    }
  };

  return (
    <div className="memory-map-stage">
      <div className="memory-map-stage-header">
        <div>
          <div className="memory-map-kicker">记忆星图</div>
          <h2>把检索过的记忆线索和历史沉淀，铺成一张可以回看的 RAG 星图</h2>
        </div>
        <p>参考记忆银行式工作台样式：以时间根节点聚合记忆碎片，点击任意星体可展开详情。</p>
      </div>

      <section className="memory-map-panel" ref={containerRef}>
        <div className="memory-map-toolbar">
          <label>
            <span>视图</span>
            <select value={viewKey} onChange={(event) => setViewKey(event.target.value as MemoryMapView)}>
              <option value="all">{VIEW_LABELS.all}</option>
              <option value="early">{VIEW_LABELS.early}</option>
              <option value="childhood">{VIEW_LABELS.childhood}</option>
              <option value="student">{VIEW_LABELS.student}</option>
              <option value="work">{VIEW_LABELS.work}</option>
              <option value="today">{VIEW_LABELS.today}</option>
            </select>
          </label>
        </div>

        <div
          className="memory-map-canvas"
          style={canvasStyle}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={stopPointerDrag}
          onPointerCancel={stopPointerDrag}
          onWheel={handleCanvasWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchGestureRef.current = null;
          }}
        >
        <div className="memory-map-background" aria-hidden="true" />

        <svg className="memory-map-links" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none">
          {graph.links.map((link) => {
            const source = nodeMap.get(link.source);
            const target = nodeMap.get(link.target);
            if (!source || !target || source.x == null || source.y == null || target.x == null || target.y == null) {
              return null;
            }
            const isActiveLink =
              interactiveNodeId != null && (link.source === interactiveNodeId || link.target === interactiveNodeId);
            const shouldDimLink = interactiveNodeId != null && !isActiveLink;
            const color = withAlpha(
              TIMELINE_COLORS[source.timeline] ?? "#64748b",
              link.kind === "root"
                ? shouldDimLink
                  ? 0.08
                  : isActiveLink
                    ? 0.46
                    : 0.26
                : shouldDimLink
                  ? 0.04
                  : isActiveLink
                    ? 0.28 + Math.min(0.2, link.similarity * 0.24)
                    : 0.08 + Math.min(0.24, link.similarity * 0.22)
            );
            return (
              <line
                key={`${link.source}-${link.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={color}
                strokeWidth={
                  link.kind === "root"
                    ? isActiveLink
                      ? 2.4
                      : shouldDimLink
                        ? 1
                        : 1.4
                    : shouldDimLink
                      ? 0.7
                      : isActiveLink
                        ? 2 + link.similarity * 1.8
                        : 0.8 + link.similarity * 1.4
                }
                strokeDasharray={link.kind === "peer" ? "4 7" : undefined}
              />
            );
          })}
        </svg>

        <div className="memory-map-nodes">
          {positionedNodes.map((node) => {
            const left = (node.x ?? 0) - (node.kind === "root" ? 24 : 18);
            const top = (node.y ?? 0) - (node.kind === "root" ? 24 : 18);
            const scale = node.kind === "root" ? 1 : use3d ? 0.92 + (((node.z ?? 0) + 60) / 120) * 0.28 : 1;
            const opacity = node.kind === "root" ? 1 : use3d ? 0.54 + (((node.z ?? 0) + 60) / 120) * 0.46 : 1;
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isRelated = activeNodeNeighborhood?.has(node.id) ?? false;
            const isDimmed = activeNodeNeighborhood != null && !isRelated;
            const relativeTime = formatMemoryTime(node.updatedAt);
            const tint = TIMELINE_COLORS[node.timeline];
            const style = {
              left,
              top,
              opacity: isDimmed ? opacity * 0.28 : opacity,
              transform: `translate3d(0, 0, 0) scale(${scale * (isDimmed ? 0.92 : isHovered ? 1.05 : 1)})`,
              borderColor: withAlpha(tint, node.kind === "root" ? 0.28 : isSelected || isHovered ? 0.38 : 0.16),
              boxShadow:
                node.kind === "root"
                  ? `0 18px 34px ${withAlpha(tint, isSelected || isHovered ? 0.28 : 0.18)}`
                  : undefined,
              ["--memory-tint" as string]: tint,
              ["--memory-surface" as string]: withAlpha(tint, node.kind === "root" ? 0.12 : 0.08),
              ["--memory-glow" as string]: withAlpha(tint, isSelected || isHovered ? 0.34 : 0.18),
              ["--memory-ring" as string]: withAlpha(tint, isSelected || isHovered ? 0.44 : 0.2),
              ["--memory-label-width" as string]: node.kind === "root" ? "82px" : "96px"
            } as CSSProperties;
            return (
              <button
                key={node.id}
                type="button"
                className={`memory-map-node ${node.kind} ${isSelected ? "selected" : ""} ${isRelated ? "related" : ""} ${isDimmed ? "dimmed" : ""}`}
                style={style}
                onClick={() => setSelectedNodeId(node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
                onFocus={() => setHoveredNodeId(node.id)}
                onBlur={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
                title={node.label}
              >
                <span className="memory-map-node-halo" aria-hidden="true" />
                <span className="memory-map-node-shell" aria-hidden="true">
                  <span className="memory-map-node-core">
                    <span className="memory-map-node-emoji">{nodeEmoji(node)}</span>
                  </span>
                </span>
                <span className="memory-map-node-label-group">
                  <span className="memory-map-node-label">{node.kind === "root" ? ROOT_LABELS[node.timeline] : trimLabel(node.label, 10)}</span>
                  {node.kind === "memory" ? (
                    <span className="memory-map-node-subtitle">
                      {relativeTime ?? `相似度 ${Math.round((node.similarity ?? 0.5) * 100)}%`}
                    </span>
                  ) : (
                    <span className="memory-map-node-subtitle">时间根节点</span>
                  )}
                </span>
                {node.kind === "memory" && (node.peerCount ?? 0) > 0 ? (
                  <span className="memory-map-node-badge">{node.peerCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="memory-map-status">
          <button type="button" className="memory-map-dimension-toggle" onClick={() => setUse3d((prev) => !prev)}>
            {use3d ? "3D" : "2D"}
          </button>
          <button
            type="button"
            className="memory-map-dimension-toggle"
            onClick={() => setCamera(INITIAL_CAMERA)}
          >
            复位视角
          </button>
          <span className="memory-map-counter">{summaryText}</span>
        </div>

        <div className="memory-map-watermark">记忆星图</div>
        </div>

        {loading ? <div className="memory-map-loading">正在编织记忆与关系的星图结构…</div> : null}
        {error ? <div className="memory-map-error">{error}</div> : null}
        {!loading && memoryNodes.length === 0 ? (
          <div className="memory-map-empty">
            <div className="memory-map-empty-title">还没有足够的记忆线索进入星图</div>
            <p>先在对话里继续沉淀记忆、触发一次带记忆依据的探索，左侧这张星图就会开始生长。</p>
          </div>
        ) : null}

        {selectedNode && selectedNode.kind === "memory" ? (
          <aside className="memory-map-detail">
            <button type="button" className="memory-map-detail-close" onClick={() => setSelectedNodeId(null)}>
              关闭
            </button>
            <div className="memory-map-detail-meta">
              <span>{VIEW_LABELS[selectedNode.timeline === "current" ? "today" : selectedNode.timeline]}</span>
              <span>{sourceLabel(selectedNode.sourceType)}</span>
              {selectedNode.peerCount ? <span>{selectedNode.peerCount} 个相邻节点</span> : null}
              {typeof selectedNode.similarity === "number" ? <span>{`相似度 ${Math.round(selectedNode.similarity * 100)}%`}</span> : null}
              {selectedNode.updatedAt ? <span>{formatMemoryTime(selectedNode.updatedAt)}</span> : null}
            </div>
            <strong>{selectedNode.label}</strong>
            <p>{selectedNode.text || "当前节点暂无更多摘要。可继续回到对话里补充这段经历。"} </p>
            {selectedNode.tags && selectedNode.tags.length > 0 ? (
              <div className="memory-map-detail-tags">
                {selectedNode.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
            {selectedPeerLinks.length > 0 ? (
              <div className="memory-map-detail-meta">
                <span>{`相似度连边 ${selectedPeerLinks.length} 条`}</span>
              </div>
            ) : null}
            <div className="memory-map-detail-actions">
              {selectedNode.conversationId ? (
                <button
                  type="button"
                  className="memory-map-open-button"
                  onClick={() => {
                    if (selectedNode.conversationId) {
                      void onOpenConversation?.(selectedNode.conversationId);
                    }
                  }}
                >
                  {selectedNode.conversationId === currentConversationId ? "当前会话" : "打开会话"}
                </button>
              ) : null}
              <button type="button" className="memory-map-open-button subtle" onClick={() => setViewKey("all")}>
                查看全部星图
              </button>
            </div>
          </aside>
        ) : null}
      </section>
    </div>
  );
}
