import { ref, computed } from "vue";
import { csvParse } from "d3";

import artistsCSV from "./artists.csv?raw";
import institutionsCSV from "./institutions.csv?raw";
import artworksCSV from "./artworks.csv?raw";
import keywordsCSV from "./keywords.csv?raw";
import artistWordsCSV from "./artist_words.csv?raw";
import institutionWordsCSV from "./institution_words.csv?raw";
import exhibitionsCSV from "./exhibitions.csv?raw";
import featuredQuotesCSV from "./featured_quotes.csv?raw";
import artistPointsJSON from "./artist_points_flat.json";

import artistClusterSummary from "./clusters/artist_cluster_summary.json";
import institutionClusterSummary from "./clusters/institution_cluster_summary.json";
import exhibitionClusters from "./clusters/exhibition_clusters.json";

// --- Derived constants ---

const _parsedArtists = csvParse(artistsCSV);
export const artistCount = _parsedArtists.length;
export const exhibitionEntryCount = csvParse(exhibitionsCSV).length;

// --- Reactive state ---

export const artistsById = ref({});
export const institutionsById = ref({});
export const artworks = ref([]);

// Pre-parsed theme rows (available after module load, no need to re-parse in components)
export const themeRows = csvParse(keywordsCSV);
export const artistWordRows = csvParse(artistWordsCSV);
export const institutionWordRows = csvParse(institutionWordsCSV);
export const artistPointsRows = artistPointsJSON;

/** Map of exhibition id (number) -> { name, location, year }. */
export const exhibitionsById = (() => {
  const map = new Map();
  csvParse(exhibitionsCSV).forEach((row) => {
    const id = Number(row.id);
    if (!Number.isFinite(id)) return;
    // date_start is in M/D/YYYY or MM/DD/YYYY format; pull the last segment.
    const yearRaw = String(row.date_start || "").split("/").pop();
    const year = yearRaw ? parseInt(yearRaw, 10) : null;
    map.set(id, {
      name: String(row.name || ""),
      location: String(row.location || ""),
      year: Number.isFinite(year) ? year : null,
    });
  });
  return map;
})();

/** Map of artist_id (string) -> featured point UUID. Rows without a UUID are skipped. */
export const featuredQuotesByArtistId = (() => {
  const rows = csvParse(featuredQuotesCSV);
  const map = new Map();
  rows.forEach((row) => {
    const aid = String(row.artist_id ?? "").trim();
    const uuid = String(row.point ?? "").trim();
    if (aid && uuid) map.set(aid, uuid);
  });
  return map;
})();
export const themePreviewTitles = computed(() =>
  themeRows.map((row) => row.word).filter(Boolean),
);

/** Precomputed cluster summaries for ClusterSection (`numClusters` entries with `groups` + `artists`). */
export const artistClustersMap = artistClusterSummary;
export const institutionClustersMap = institutionClusterSummary;
function buildExhibitionClustersMap() {
  const src =
    exhibitionClusters && !Array.isArray(exhibitionClusters)
      ? exhibitionClusters
      : { exhibitions: [], artists: [] };
  const exhibitions = Array.isArray(src.exhibitions)
    ? src.exhibitions.map((row) => ({
        id: Number(row.id),
        name: row.name ?? `Exhibition ${row.id}`,
        labels: Array.isArray(row.labels) ? row.labels : [],
      }))
    : [];
  const artists = Array.isArray(src.artists)
    ? src.artists
        .map((row) => {
          const exhibitionIds = Array.isArray(row.exhibitionIds)
            ? row.exhibitionIds
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id))
            : [];
          return {
            artistId: Number(row.artistId),
            exhibitionIds,
            isShared: Boolean(row.isShared ?? exhibitionIds.length > 1),
            _radius_frac: Number(
              row._radius_frac ?? (exhibitionIds.length > 1 ? 0.85 : 0.35),
            ),
            _angle: row._angle == null ? null : Number(row._angle),
            _jitter_angle:
              row._jitter_angle == null ? null : Number(row._jitter_angle),
          };
        })
        .filter((row) => Number.isFinite(row.artistId))
    : [];
  return { exhibitions, artists };
}

export const exhibitionClustersMap = buildExhibitionClustersMap();

export function fetchAndParseData() {
  const artistArr = csvParse(artistsCSV);
  const institutionArr = csvParse(institutionsCSV);
  const artworkArr = csvParse(artworksCSV);

  artistsById.value = Object.fromEntries(artistArr.map((a) => [a.id, a]));

  institutionsById.value = Object.fromEntries(
    institutionArr.map((i) => [i.id, { ...i }]),
  );

  artworks.value = artworkArr.map((a) => ({
    ...a,
    artistName: artistsById.value[a.artist]?.name || a.artist,
    institutionName:
      institutionsById.value[a.institution]?.name || a.institution,
  }));
}
