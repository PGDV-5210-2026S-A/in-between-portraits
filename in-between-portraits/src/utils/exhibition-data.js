export function parseArtistIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw).replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function exhibitionStartYear(dateStart) {
  if (!dateStart) return null;
  const parts = String(dateStart).split("/");
  const year = Number(parts[parts.length - 1]);
  return Number.isFinite(year) ? String(year) : null;
}

export function buildArtistInstitutionIndex(artworksList, institutionsMap) {
  const artistIdsByInstitutionId = new Map();
  const institutionIdsByArtistId = new Map();

  for (const row of artworksList ?? []) {
    const artistId = String(row?.artist ?? "").trim();
    const institutionId = String(row?.institution ?? "").trim();
    if (!artistId || !institutionsMap?.[institutionId]) continue;

    if (!artistIdsByInstitutionId.has(institutionId)) {
      artistIdsByInstitutionId.set(institutionId, new Set());
    }
    artistIdsByInstitutionId.get(institutionId).add(artistId);

    if (!institutionIdsByArtistId.has(artistId)) {
      institutionIdsByArtistId.set(artistId, new Set());
    }
    institutionIdsByArtistId.get(artistId).add(institutionId);
  }

  const institutionNamesByArtistId = {};
  for (const [artistId, ids] of institutionIdsByArtistId) {
    institutionNamesByArtistId[artistId] = [...ids]
      .map((id) => String(institutionsMap?.[id]?.name ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  return {
    artistIdsByInstitutionId,
    institutionIdsByArtistId,
    institutionNamesByArtistId,
  };
}
