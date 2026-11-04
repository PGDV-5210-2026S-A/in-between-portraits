<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyLeft } from "d3-sankey";
import { createTooltip } from "../../utils/d3/tooltip.js";
import {
  artistTooltipShowOptions,
  exhibitionTooltipShowOptions,
  institutionTooltipShowOptions,
} from "../../utils/exhibition-tooltip.js";
import {
  buildArtistInstitutionIndex,
  exhibitionStartYear,
  parseArtistIds,
} from "../../utils/exhibition-data.js";
import {
  EXHIBITIONS_SANKEY_BRIDGE_ATTR,
  EXHIBITIONS_SANKEY_LABEL_OFFSET_PX,
  EXHIBITIONS_VIZ_CONFIG,
  exhibitionMarkHeightPx,
} from "../../constants/exhibitions-viz.js";
import {
  CSS_LETTER_SPACING_UI,
  DOT_SIZE_PX,
  FONT_BODY,
  FONT_SIZE_UI_PX,
} from "../../constants.js";
import { getArtistDotData } from "../../utils/artist-dot.js";
import { artistsById, artworks, institutionsById } from "../../data/index.js";
import exhibitionsCSV from "../../data/exhibitions.csv?raw";

const NODE_WIDTH = EXHIBITIONS_VIZ_CONFIG.layout.nodeSizePx;
const NODE_PADDING = 30;
const LABEL_OFFSET_PX = EXHIBITIONS_SANKEY_LABEL_OFFSET_PX;
const ARTIST_TO_INSTITUTION_MIN_SPAN_PX =
  EXHIBITIONS_VIZ_CONFIG.layout.artistToInstitutionMinSpanPx;
const EXHIBITION_TO_ARTIST_MIN_SPAN_PX =
  EXHIBITIONS_VIZ_CONFIG.layout.exhibitionToArtistMinSpanPx;
const ARTIST_NAME_LINK_GAP_PX = EXHIBITIONS_VIZ_CONFIG.layout.artistNameLinkGapPx;
const INSTITUTION_LABEL_EDGE_PADDING_PX =
  EXHIBITIONS_VIZ_CONFIG.layout.institutionLabelEdgePaddingPx;
const MIN_COLUMN_GAP_PX = 8;
const MAX_COLUMN_GAP_PX = 72;
const LABEL_LINE_HEIGHT_EM = 1.1;
const LABEL_SINGLE_LINE_DY_EM = 0.35;
const LINK_STROKE = EXHIBITIONS_VIZ_CONFIG.stroke.linkPx;
const BASE_REQUIRED_HEIGHT = 600;

const containerRef = ref(null);
let destroyTooltip = null;

const institutionIndex = computed(() =>
  buildArtistInstitutionIndex(artworks.value, institutionsById.value),
);

function artistLifeLine(row) {
  if (!row) return null;
  const by = String(row.birth_year ?? "").trim();
  const dy = String(row.death_year ?? "").trim();
  if (!by) return null;
  if (dy) return `(${by} - ${dy})`;
  return `(${by} - )`;
}

const EXHIBITION_LINE_MAX_CHARS = 26;
const INSTITUTION_LINE_MAX_CHARS = 16;
const WRAP_EXTRA_LINE_WEIGHT = 7;

function nodeCenterY(d) {
  return (d.y0 + d.y1) / 2;
}

function nodeLabelLines(d) {
  if (d.type === "artist") return [d.name];
  return wrapTitleLines(
    d.name,
    d.type === "institution" ? INSTITUTION_LINE_MAX_CHARS : EXHIBITION_LINE_MAX_CHARS,
  );
}

function rectNodeHeight(d) {
  return exhibitionMarkHeightPx(d.artistCount);
}

function nodeBlockHeight(d) {
  const labelHeight = d.labelLines.length * FONT_SIZE_UI_PX * LABEL_LINE_HEIGHT_EM;
  return Math.max(rectNodeHeight(d), labelHeight);
}

// Re-space a column by what is drawn, not by link value, so rects and wrapped
// labels stop overlapping. `linkEdge` is "y0" or "y1" for source/target columns.
function spaceColumnByBlockHeight(columnNodes, links, plotTop, plotBottom, linkEdge) {
  if (columnNodes.length < 2) return;

  const ordered = [...columnNodes].sort((a, b) => nodeCenterY(a) - nodeCenterY(b));
  const totalBlockHeight = d3.sum(ordered, nodeBlockHeight);
  const evenGap = (plotBottom - plotTop - totalBlockHeight) / (ordered.length - 1);
  const gap = Math.min(MAX_COLUMN_GAP_PX, Math.max(MIN_COLUMN_GAP_PX, evenGap));

  let top = plotTop;
  for (const node of ordered) {
    const blockHeight = nodeBlockHeight(node);
    const markHeight = rectNodeHeight(node);
    const center = top + blockHeight / 2;
    node.y0 = center - markHeight / 2;
    node.y1 = center + markHeight / 2;
    top += blockHeight + gap;
  }

  const endpoint = linkEdge === "y0" ? "source" : "target";
  const columnNodeSet = new Set(columnNodes);
  const attachedByNodeId = d3.group(
    links.filter((link) => columnNodeSet.has(link[endpoint])),
    (link) => link[endpoint].nodeId,
  );
  for (const [, attached] of attachedByNodeId) {
    const node = attached[0][endpoint];
    const step = rectNodeHeight(node) / (attached.length + 1);
    attached
      .sort((a, b) => a[linkEdge] - b[linkEdge])
      .forEach((link, i) => {
        link[linkEdge] = node.y0 + step * (i + 1);
      });
  }
}

function wrapGreedyWords(trimmed, max) {
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  function flushWordTooLong(word) {
    if (current) {
      lines.push(current);
      current = "";
    }
    for (let i = 0; i < word.length; i += max) {
      lines.push(word.slice(i, i + max));
    }
  }

  for (const word of words) {
    if (word.length > max) {
      flushWordTooLong(word);
      continue;
    }
    const trial = current ? `${current} ${word}` : word;
    if (trial.length <= max) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [trimmed];
}

function expandOversizedWords(words, max) {
  const out = [];
  for (const w of words) {
    if (w.length <= max) out.push(w);
    else {
      for (let i = 0; i < w.length; i += max) out.push(w.slice(i, i + max));
    }
  }
  return out;
}

function minLinesForWords(words, max) {
  const n = words.length;
  if (n === 0) return 0;
  const dp = Array(n + 1).fill(Infinity);
  dp[0] = 0;
  for (let end = 1; end <= n; end++) {
    for (let start = 0; start < end; start++) {
      const seg = words.slice(start, end).join(" ");
      if (seg.length > max) continue;
      if (Number.isFinite(dp[start])) {
        dp[end] = Math.min(dp[end], dp[start] + 1);
      }
    }
  }
  return dp[n];
}

function lineLengthRange(lines) {
  const lens = lines.map((l) => l.trim().length);
  if (!lens.length) return 0;
  return Math.max(...lens) - Math.min(...lens);
}

function lineLengthVarianceScore(lines) {
  const lens = lines.map((l) => l.trim().length);
  if (!lens.length) return 0;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  return lens.reduce((acc, len) => acc + (len - mean) ** 2, 0);
}

function wrapBalancedWordsForK(words, max, k) {
  const n = words.length;
  if (k < 1 || n === 0) return null;
  if (k === 1) {
    const one = words.join(" ");
    return one.length <= max ? [one] : null;
  }

  const lens = words.map((word) => word.length);
  const prefix = [0];
  for (let i = 0; i < n; i++) prefix.push(prefix[i] + lens[i]);

  function segmentLength(i, jExclusive) {
    const wordsLen = prefix[jExclusive] - prefix[i];
    const spaces = Math.max(0, jExclusive - i - 1);
    return wordsLen + spaces;
  }

  const targetLen = words.join(" ").length / k;
  const dp = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity));
  const prev = Array.from({ length: k + 1 }, () => Array(n + 1).fill(-1));
  dp[0][0] = 0;

  for (let line = 1; line <= k; line++) {
    for (let end = 1; end <= n; end++) {
      for (let start = 0; start < end; start++) {
        if (!Number.isFinite(dp[line - 1][start])) continue;
        const len = segmentLength(start, end);
        if (len > max) continue;
        const cost = dp[line - 1][start] + (len - targetLen) ** 2;
        if (cost < dp[line][end]) {
          dp[line][end] = cost;
          prev[line][end] = start;
        }
      }
    }
  }

  if (!Number.isFinite(dp[k][n])) return null;

  const lines = [];
  let end = n;
  for (let line = k; line >= 1; line--) {
    const start = prev[line][end];
    if (start < 0) return null;
    lines.push(words.slice(start, end).join(" "));
    end = start;
  }
  lines.reverse();
  return lines.length ? lines : null;
}

function balanceWordLines(words, max) {
  const expanded = expandOversizedWords(words, max);
  if (!expanded.length) return [];
  const joined = expanded.join(" ");
  if (joined.length <= max) return [joined];

  const minK = minLinesForWords(expanded, max);
  if (!Number.isFinite(minK) || minK < 1) {
    return wrapGreedyWords(joined, max);
  }

  const maxKTry = Math.min(minK + 2, expanded.length);
  let bestLines = null;
  let bestScore = Infinity;
  let bestRange = Infinity;
  let bestK = Infinity;

  for (let k = minK; k <= maxKTry; k++) {
    const candidate = wrapBalancedWordsForK(expanded, max, k);
    if (!candidate) continue;
    const range = lineLengthRange(candidate);
    const variance = lineLengthVarianceScore(candidate);
    const extra = Math.max(0, k - minK);
    const score = (range + extra * WRAP_EXTRA_LINE_WEIGHT) * 1000 + variance;
    if (
      score < bestScore ||
      (score === bestScore && range < bestRange) ||
      (score === bestScore && range === bestRange && k < bestK)
    ) {
      bestLines = candidate;
      bestScore = score;
      bestRange = range;
      bestK = k;
    }
  }

  return bestLines?.length ? bestLines : wrapGreedyWords(joined, max);
}

function fixWidowLastLine(lines, max) {
  if (lines.length < 2) return lines;

  const MERGE_ORPHAN_MAX_LEN = 5;

  const last = lines[lines.length - 1].trim();
  const prev = lines[lines.length - 2].trim();
  const lastWords = last.split(/\s+/).filter(Boolean);
  if (lastWords.length !== 1) return lines;

  const orphan = lastWords[0];

  if (orphan.length <= MERGE_ORPHAN_MAX_LEN) {
    const merged = `${prev} ${orphan}`;
    if (merged.length <= max) {
      return [...lines.slice(0, -2), merged];
    }
  }

  const prevWords = prev.split(/\s+/).filter(Boolean);
  if (prevWords.length < 2) return lines;

  const newPrev = prevWords.slice(0, -1).join(" ");
  const newLast = `${prevWords[prevWords.length - 1]} ${orphan}`;
  if (newPrev.length <= max && newLast.length <= max) {
    return [...lines.slice(0, -2), newPrev, newLast];
  }

  return lines;
}

function wrapTitleLines(name, max = EXHIBITION_LINE_MAX_CHARS) {
  const trimmed = name.trim();
  if (!trimmed) return [name];
  if (trimmed.length <= max) return [trimmed];

  const colonIdx = trimmed.indexOf(":");
  const allWords = trimmed.split(/\s+/).filter(Boolean);
  let lines;
  if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
    const prefix = trimmed.slice(0, colonIdx + 1).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();
    if (!rest.length) {
      lines = prefix.length <= max ? [prefix] : balanceWordLines(allWords, max);
    } else if (prefix.length <= max) {
      const words = [prefix, ...rest.split(/\s+/).filter(Boolean)];
      lines = balanceWordLines(words, max);
    } else {
      lines = balanceWordLines(allWords, max);
    }
  } else {
    lines = balanceWordLines(allWords, max);
  }

  return fixWidowLastLine(lines, max);
}

// Measured in the live SVG so the CSS letter-spacing variable is applied.
function measureTextWidths(svg, texts) {
  const probe = svg
    .append("text")
    .attr("class", "sankey-node-label")
    .attr("visibility", "hidden")
    .style("font-family", FONT_BODY)
    .style("font-size", `${FONT_SIZE_UI_PX}px`)
    .style("letter-spacing", CSS_LETTER_SPACING_UI);
  const probeNode = probe.node();

  const widths = new Map();
  for (const text of texts) {
    if (widths.has(text)) continue;
    probe.text(text);
    widths.set(text, probeNode.getComputedTextLength());
  }
  probe.remove();
  return widths;
}

function drawNodeLabel(g, d) {
  const y = nodeCenterY(d);
  const x = d.type === "exhibition" ? d.x0 - LABEL_OFFSET_PX : d.x1 + LABEL_OFFSET_PX;
  const anchor = d.type === "exhibition" ? "end" : "start";

  const text = g
    .append("text")
    .attr("class", "sankey-node-label")
    .attr("x", x)
    .attr("y", y)
    .attr("text-anchor", anchor)
    .attr("fill", "#fff")
    .style("font-family", FONT_BODY)
    .style("font-size", `${FONT_SIZE_UI_PX}px`)
    .style("letter-spacing", CSS_LETTER_SPACING_UI)
    .style("cursor", "default")
    .style("user-select", "none")
    .style("-webkit-user-select", "none");

  const lines = d.labelLines;
  if (lines.length === 1) {
    text.attr("dy", `${LABEL_SINGLE_LINE_DY_EM}em`).text(lines[0]);
    return;
  }

  text
    .append("tspan")
    .attr("x", x)
    .attr("dy", `${-((lines.length - 1) * LABEL_LINE_HEIGHT_EM) / 4}em`)
    .text(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    text
      .append("tspan")
      .attr("x", x)
      .attr("dy", `${LABEL_LINE_HEIGHT_EM}em`)
      .text(lines[i]);
  }
}

const graphData = computed(() => {
  const { artistIdsByInstitutionId, institutionIdsByArtistId, institutionNamesByArtistId } =
    institutionIndex.value;
  const exhibitionRows = d3.csvParse(exhibitionsCSV);
  const exhibitions = exhibitionRows.map((r) => ({
    id: r.id,
    name: r.name || "Untitled Exhibition",
    location: r.location || "",
    startYear: exhibitionStartYear(r.date_start),
    artistIds: parseArtistIds(r.artists),
  }));

  const artistIdSet = new Set();
  exhibitions.forEach((e) => e.artistIds.forEach((id) => artistIdSet.add(id)));

  const institutionIds = [...artistIdsByInstitutionId.keys()].sort(
    (a, b) => Number(a) - Number(b),
  );

  const nodes = [
    ...exhibitions.map((e) => ({
      nodeId: `ex-${e.id}`,
      name: e.name,
      location: e.location,
      startYear: e.startYear,
      artistCount: e.artistIds.length,
      type: "exhibition",
    })),
    ...[...artistIdSet].map((id) => {
      const row = artistsById.value[id];
      const fallback = `Artist ${id}`;
      return {
        nodeId: `ar-${id}`,
        name: row?.name || fallback,
        lifeLine: artistLifeLine(row),
        institutionNames: institutionNamesByArtistId[id] ?? [],
        type: "artist",
      };
    }),
    ...institutionIds.map((id) => {
      const row = institutionsById.value[id];
      return {
        nodeId: `in-${id}`,
        name: row?.name || `Institution ${id}`,
        location: row?.location || "",
        visitors: row?.["2025_visitors"] || "",
        ranking: row?.["2025_visited_ranking"] || "",
        artistCount: artistIdsByInstitutionId.get(id)?.size ?? 0,
        type: "institution",
      };
    }),
  ];

  const nodeIndex = {};
  nodes.forEach((n, i) => (nodeIndex[n.nodeId] = i));

  const links = [];
  exhibitions.forEach((e) => {
    e.artistIds.forEach((aid) => {
      links.push({
        source: nodeIndex[`ex-${e.id}`],
        target: nodeIndex[`ar-${aid}`],
        value: 1,
      });
    });
  });

  artistIdSet.forEach((aid) => {
    const ids = institutionIdsByArtistId.get(aid);
    if (!ids) return;
    [...ids]
      .sort((a, b) => Number(a) - Number(b))
      .forEach((iid) => {
        links.push({
          source: nodeIndex[`ar-${aid}`],
          target: nodeIndex[`in-${iid}`],
          value: 1,
        });
      });
  });

  return { nodes, links };
});

function renderChart() {
  const root = containerRef.value;
  if (!root) return;
  destroyTooltip?.();
  destroyTooltip = null;
  d3.select(root).selectAll("*").remove();

  const { nodes, links } = graphData.value;
  if (!nodes.length) return;

  const labelledNodes = nodes.map((d) => ({ ...d, labelLines: nodeLabelLines(d) }));

  const width = root.clientWidth || 900;
  const baseHeight = root.clientHeight || BASE_REQUIRED_HEIGHT;
  const margin = EXHIBITIONS_VIZ_CONFIG.layout.margin;
  const nodesByType = d3.group(labelledNodes, (d) => d.type);
  const densestColumnCount = Math.max(...[...nodesByType.values()].map((v) => v.length), 1);
  const requiredPlotHeight = Math.max(
    densestColumnCount * NODE_WIDTH + (densestColumnCount - 1) * NODE_PADDING,
    ...[...nodesByType.values()].map(
      (column) => d3.sum(column, nodeBlockHeight) + (column.length - 1) * MIN_COLUMN_GAP_PX,
    ),
  );
  const requiredHeight = Math.ceil(requiredPlotHeight + margin.top + margin.bottom);
  const height = Math.max(baseHeight, requiredHeight);

  const sankeyLayout = d3Sankey()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .nodeAlign(sankeyLeft)
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom],
    ]);

  const graph = sankeyLayout({
    nodes: labelledNodes.map((d) => ({ ...d })),
    links: links.map((d) => ({ ...d })),
  });

  const svg = d3
    .select(root)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const artistNameWidths = measureTextWidths(
    svg,
    graph.nodes.filter((d) => d.type === "artist").map((d) => d.name),
  );
  const institutionLineWidths = measureTextWidths(
    svg,
    graph.nodes.filter((d) => d.type === "institution").flatMap((d) => d.labelLines),
  );
  const widestArtistName = d3.max(artistNameWidths.values()) ?? 0;
  const meanArtistName = d3.mean(artistNameWidths.values()) ?? 0;
  const widestInstitutionLine = d3.max(institutionLineWidths.values()) ?? 0;

  const exhibitionColumnX = margin.left;
  // Sits on the shared right margin so the timeline lines up, unless labels need more.
  const institutionColumnX = Math.min(
    width - margin.right - NODE_WIDTH,
    width -
      INSTITUTION_LABEL_EDGE_PADDING_PX -
      widestInstitutionLine -
      LABEL_OFFSET_PX -
      NODE_WIDTH,
  );

  // Mean name width, not widest: centres the ragged-right block optically.
  const artistBlockWidth = NODE_WIDTH + LABEL_OFFSET_PX + meanArtistName;
  const columnsMidpointX = (exhibitionColumnX + institutionColumnX + NODE_WIDTH) / 2;
  const artistColumnX = Math.max(
    exhibitionColumnX + NODE_WIDTH + EXHIBITION_TO_ARTIST_MIN_SPAN_PX,
    Math.min(
      columnsMidpointX - artistBlockWidth / 2,
      institutionColumnX -
        ARTIST_TO_INSTITUTION_MIN_SPAN_PX -
        widestArtistName -
        LABEL_OFFSET_PX -
        NODE_WIDTH,
    ),
  );
  const columnX = {
    exhibition: exhibitionColumnX,
    artist: artistColumnX,
    institution: institutionColumnX,
  };
  graph.nodes.forEach((d) => {
    const x0 = columnX[d.type];
    if (x0 == null) return;
    d.x0 = x0;
    d.x1 = x0 + NODE_WIDTH;
  });

  spaceColumnByBlockHeight(
    graph.nodes.filter((d) => d.type === "exhibition"),
    graph.links,
    margin.top,
    height - margin.bottom,
    "y0",
  );
  spaceColumnByBlockHeight(
    graph.nodes.filter((d) => d.type === "institution"),
    graph.links,
    margin.top,
    height - margin.bottom,
    "y1",
  );

  // Pin to the dot: artist bands are tall enough that links would otherwise fan off it.
  graph.links.forEach((link) => {
    if (link.source?.type === "artist") link.y0 = nodeCenterY(link.source);
    if (link.target?.type === "artist") link.y1 = nodeCenterY(link.target);
  });

  const exhibitionLabelAnchorX = exhibitionColumnX - LABEL_OFFSET_PX;
  const artistLabelAnchorX = artistColumnX + NODE_WIDTH + LABEL_OFFSET_PX;
  svg
    .attr(EXHIBITIONS_SANKEY_BRIDGE_ATTR.exhibitionLabelAnchorX, String(exhibitionLabelAnchorX))
    .attr(EXHIBITIONS_SANKEY_BRIDGE_ATTR.artistLabelAnchorX, String(artistLabelAnchorX))
    .attr(
      EXHIBITIONS_SANKEY_BRIDGE_ATTR.institutionLabelAnchorX,
      String(institutionColumnX + NODE_WIDTH + LABEL_OFFSET_PX),
    );

  const { show, hide, destroy } = createTooltip(root);
  destroyTooltip = destroy;
  let hoveredNodeId = null;

  function tooltipOptionsForNode(d) {
    if (d.type === "exhibition") return exhibitionTooltipShowOptions(d);
    if (d.type === "institution") return institutionTooltipShowOptions(d);
    return artistTooltipShowOptions(d);
  }

  function connectedContext(nodeId) {
    const activeLinkKeys = new Set();
    const activeNodeIds = new Set([nodeId]);
    for (const link of graph.links) {
      const sourceId = link.source?.nodeId;
      const targetId = link.target?.nodeId;
      const isConnected = sourceId === nodeId || targetId === nodeId;
      if (!isConnected) continue;
      activeLinkKeys.add(`${sourceId}->${targetId}`);
      if (sourceId) activeNodeIds.add(sourceId);
      if (targetId) activeNodeIds.add(targetId);
    }
    return { activeLinkKeys, activeNodeIds };
  }

  // Links out of an artist leave the end of the rendered name, not the dot.
  const sankeyLinkPath = sankeyLinkHorizontal();
  const artistNameLinkPath = d3
    .linkHorizontal()
    .source((link) => [
      link.source.x1 +
        LABEL_OFFSET_PX +
        (artistNameWidths.get(link.source.name) ?? 0) +
        ARTIST_NAME_LINK_GAP_PX,
      link.y0,
    ])
    .target((link) => [link.target.x0, link.y1]);

  const linkSelection = svg
    .append("g")
    .selectAll("path")
    .data(graph.links)
    .enter()
    .append("path")
    .attr("d", (link) =>
      link.source.type === "artist" ? artistNameLinkPath(link) : sankeyLinkPath(link),
    )
    .attr("fill", "none")
    .attr("stroke", "#fff")
    .attr("stroke-width", LINK_STROKE)
    .attr("stroke-opacity", 1)
    .style("pointer-events", "none");

  const nodeGroup = svg
    .append("g")
    .selectAll("g")
    .data(graph.nodes)
    .enter()
    .append("g");

  function nodeFill(d) {
    return d.type === "artist" ? "#000" : "#fff";
  }

  function nodeFillHover(d) {
    return d.type === "artist" ? "#111" : "#fff";
  }

  const rectNodes = nodeGroup
    .filter((d) => d.type !== "artist")
    .append("rect")
    .attr("class", "sankey-node-mark")
    .attr("data-node-id", (d) => d.nodeId)
    .attr("data-exhibition-id", (d) =>
      d.type === "exhibition" ? d.nodeId.slice(3) : null,
    )
    .attr("data-institution-id", (d) =>
      d.type === "institution" ? d.nodeId.slice(3) : null,
    )
    .attr("x", (d) => d.x0)
    .attr("y", (d) => nodeCenterY(d) - rectNodeHeight(d) / 2)
    .attr("height", rectNodeHeight)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", nodeFill)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .attr("rx", EXHIBITIONS_VIZ_CONFIG.layout.nodeRadiusPx)
    .style("cursor", "default");

  function artistDotTransform(d) {
    const dot = getArtistDotData(d.nodeId.slice(3));
    if (!dot) return null;
    const [, , vbW, vbH] = dot.viewBox.split(/\s+/).map(Number);
    const scale = DOT_SIZE_PX / Math.max(vbW, vbH);
    const cx = (d.x0 + d.x1) / 2 - 3;
    const cy = nodeCenterY(d);
    const tx = cx - (vbW * scale) / 2;
    const ty = cy - (vbH * scale) / 2;
    return `translate(${tx}, ${ty}) scale(${scale})`;
  }

  const artistNodes = nodeGroup
    .filter((d) => d.type === "artist")
    .append("g")
    .attr("class", "sankey-node-mark")
    .attr("data-node-id", (d) => d.nodeId)
    .attr("data-artist-id", (d) => d.nodeId.slice(3))
    .attr("transform", (d) => artistDotTransform(d) || "")
    .attr("fill", nodeFill)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .style("cursor", "default");

  artistNodes
    .append("path")
    .attr("d", (d) => getArtistDotData(d.nodeId.slice(3))?.d || "")
    .attr("vector-effect", "non-scaling-stroke");

  // Increase hover affordance for tiny artist dots.
  nodeGroup
    .filter((d) => d.type === "artist")
    .append("circle")
    .attr("class", "sankey-node-hit")
    .attr("cx", (d) => (d.x0 + d.x1) / 2 - 3)
    .attr("cy", nodeCenterY)
    .attr("r", Math.max(DOT_SIZE_PX, 8))
    .attr("fill", "transparent")
    .style("cursor", "default");

  function applyHoverState(nodeId = null) {
    hoveredNodeId = nodeId;
    if (!nodeId) {
      linkSelection
        .attr("stroke-opacity", 1)
        .attr("stroke-width", LINK_STROKE);
      svg
        .selectAll(".sankey-node-mark")
        .attr("stroke-opacity", 1)
        .attr("opacity", 1)
        .attr("stroke-width", 1)
        .attr("fill", (d) => nodeFill(d));
      svg.selectAll(".sankey-node-label").attr("opacity", 1).style("font-weight", 400);
      return;
    }

    const { activeLinkKeys, activeNodeIds } = connectedContext(nodeId);
    linkSelection
      .attr("stroke-opacity", (d) =>
        activeLinkKeys.has(`${d.source?.nodeId}->${d.target?.nodeId}`) ? 1 : 0.4,
      )
      .attr("stroke-width", (d) =>
        activeLinkKeys.has(`${d.source?.nodeId}->${d.target?.nodeId}`)
          ? LINK_STROKE + 0.35
          : LINK_STROKE,
      );
    svg
      .selectAll("rect.sankey-node-mark")
      .attr("opacity", (d) => (activeNodeIds.has(d.nodeId) ? 1 : 0.25))
      .attr("stroke-width", (d) => (d.nodeId === nodeId ? 2 : 1))
      .attr("fill", (d) =>
        d.nodeId === nodeId || activeNodeIds.has(d.nodeId) ? nodeFillHover(d) : nodeFill(d),
      );
    svg
      .selectAll("g.sankey-node-mark")
      .attr("stroke-opacity", (d) => (activeNodeIds.has(d.nodeId) ? 1 : 0.25))
    svg
      .selectAll(".sankey-node-label")
      .attr("opacity", (d) => (activeNodeIds.has(d.nodeId) ? 1 : 0.6))
      .style("font-weight", (d) => (d.nodeId === nodeId ? 600 : 400));
  }

  function bindNodeHover(selection) {
    selection
      .on("mouseenter", function (event, d) {
        applyHoverState(d.nodeId);
        show(event, tooltipOptionsForNode(d));
      })
      .on("mousemove", function (event, d) {
        if (hoveredNodeId !== d.nodeId) applyHoverState(d.nodeId);
        show(event, tooltipOptionsForNode(d));
      })
      .on("mouseleave", function () {
        applyHoverState(null);
        hide();
      });
  }

  [rectNodes, artistNodes, svg.selectAll(".sankey-node-hit")].forEach(
    bindNodeHover,
  );

  nodeGroup.each(function (d) {
    const g = d3.select(this);
    drawNodeLabel(g, d);
  });

  bindNodeHover(nodeGroup.selectAll(".sankey-node-label"));
}

function handleResize() {
  renderChart();
}

let resizeObserver = null;

onMounted(() => {
  renderChart();
  // Column placement depends on measured text, so re-measure once the webfont swaps in.
  document.fonts?.ready?.then(() => {
    if (containerRef.value) renderChart();
  });
  window.addEventListener("resize", handleResize);
  if (typeof ResizeObserver !== "undefined" && containerRef.value) {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  resizeObserver?.disconnect();
  destroyTooltip?.();
  destroyTooltip = null;
});

watch(graphData, renderChart, { deep: true });
</script>

<template>
  <div ref="containerRef" class="exhibitions-sankey"></div>
</template>

<style scoped src="./style.css"></style>
