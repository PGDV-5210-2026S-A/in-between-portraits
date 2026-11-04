/** Same inset as `src/style.css` `.exhibitions-bridge-label__track` fallback and Sankey/Timeline margins. */
export const EXHIBITIONS_INNER_MARGIN_X_PX = 236;

/** Narrower than the left inset: institution labels wrap shorter than exhibition titles. */
export const EXHIBITIONS_INNER_MARGIN_RIGHT_PX = 184;

/** Must match ExhibitionsSankey `drawNodeLabel` offset. */
export const EXHIBITIONS_SANKEY_LABEL_OFFSET_PX = 8;

export const EXHIBITIONS_SANKEY_BRIDGE_ATTR = {
  exhibitionLabelAnchorX: "data-exhibition-label-anchor-x",
  artistLabelAnchorX: "data-artist-label-anchor-x",
  institutionLabelAnchorX: "data-institution-label-anchor-x",
};

/** Shared geometry + styling config for exhibition timeline/sankey visuals. */
export const EXHIBITIONS_VIZ_CONFIG = {
  layout: {
    /** Same inset as Sankey `extent` / inner plot band (matches section padding visually). */
    margin: {
      top: 12,
      right: EXHIBITIONS_INNER_MARGIN_RIGHT_PX,
      bottom: 12,
      left: EXHIBITIONS_INNER_MARGIN_X_PX,
    },
    /**
     * Sankey node column thickness (`nodeWidth`) and timeline markers (square w × h).
     * Change this single value to resize nodes in both views.
     */
    nodeSizePx: 8,
    /** Corner radius for Sankey rects and timeline markers (`rx` / `ry`). */
    nodeRadiusPx: 1,
    /** Shortest allowed run from the longest artist name to the institution column. */
    artistToInstitutionMinSpanPx: 120,
    /** Shortest allowed run from the exhibition column to the artist column. */
    exhibitionToArtistMinSpanPx: 160,
    /** Gap between the end of an artist name and the start of its outgoing link. */
    artistNameLinkGapPx: 6,
    /** Breathing room kept to the right of the institution labels. */
    institutionLabelEdgePaddingPx: 24,
    /**
     * Shared scale factor for exhibition rectangle heights across timeline and Sankey.
     * Heights remain proportional to artist count while matching between both views.
     */
    markHeightPerArtistPx: 6,
  },
  stroke: {
    /** Sankey links and timeline baseline stroke (px). */
    linkPx: 1.1,
  },
};

export function exhibitionMarkHeightPx(artistCount) {
  const count = Number.isFinite(artistCount) ? artistCount : 0;
  return Math.max(
    EXHIBITIONS_VIZ_CONFIG.layout.nodeSizePx,
    count * EXHIBITIONS_VIZ_CONFIG.layout.markHeightPerArtistPx,
  );
}
