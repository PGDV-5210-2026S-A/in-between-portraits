export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exhibitionTooltipShowOptions(d) {
  const year = d.startYear ? escapeHtml(d.startYear) : "-";
  const loc = d.location ? escapeHtml(d.location) : "-";
  const artistCount = Array.isArray(d.artistIds)
    ? d.artistIds.length
    : Number.isFinite(Number(d.artistCount))
      ? Number(d.artistCount)
      : null;
  const artistLine =
    artistCount == null
      ? ""
      : `<div>${artistCount} ${artistCount === 1 ? "artist" : "artists"}</div>`;
  return {
    bg: "#fff",
    fg: "#111",
    border: "#111",
    html: `<div style="line-height:1.25"><div><strong>${escapeHtml(d.name)}</strong></div><div style="height:0.8em"></div><div>${loc} (${year})</div>${artistLine}</div>`,
  };
}

export function institutionTooltipShowOptions(d) {
  const loc = d.location ? escapeHtml(d.location) : "-";
  const count = Number(d.artistCount);
  const artistLine = Number.isFinite(count)
    ? `<div>${count} ${count === 1 ? "artist" : "artists"}</div>`
    : "";
  const visitorLine = d.visitors
    ? `<div>${escapeHtml(d.visitors)} visitors in 2025${
        d.ranking ? ` (#${escapeHtml(d.ranking)})` : ""
      }</div>`
    : "";
  return {
    bg: "#fff",
    fg: "#111",
    border: "#111",
    html: `<div style="line-height:1.25"><div><strong>${escapeHtml(d.name)}</strong></div><div style="height:0.8em"></div><div>${loc}</div>${artistLine}${visitorLine}</div>`,
  };
}

export function artistTooltipShowOptions(d) {
  const life = d.lifeLine
    ? `<div style="margin-top:2px">${escapeHtml(d.lifeLine)}</div>`
    : "";
  const names = Array.isArray(d.institutionNames) ? d.institutionNames.filter(Boolean) : [];
  const institutionsHtml = names.length
    ? `<div style="height:0.8em"></div>${names
        .map((n, i) => {
          const t = escapeHtml(n);
          const line = i < names.length - 1 ? `${t},` : t;
          return `<div style="white-space:nowrap">${line}</div>`;
        })
        .join("")}`
    : "";
  return {
    bg: "#000",
    fg: "#fff",
    border: "#fff",
    html: `<div style="line-height:1.25"><div><strong>${escapeHtml(d.name)}</strong></div>${life}${institutionsHtml}</div>`,
  };
}
