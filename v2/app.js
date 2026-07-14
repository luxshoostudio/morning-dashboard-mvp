const state = {
  data: null,
  sectionId: "news",
  sourceId: "all",
  topic: "all",
  lang: "en",
  query: ""
};

const els = {
  status: document.querySelector("#status"),
  tabs: document.querySelector("#sectionTabs"),
  sourceFilters: document.querySelector("#sourceFilters"),
  topicFilters: document.querySelector("#topicFilters"),
  sourceHealth: document.querySelector("#sourceHealth"),
  clearSource: document.querySelector("#clearSource"),
  clearTopic: document.querySelector("#clearTopic"),
  search: document.querySelector("#searchInput"),
  sectionDescription: document.querySelector("#sectionDescription"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCount: document.querySelector("#resultCount"),
  emptyState: document.querySelector("#emptyState"),
  items: document.querySelector("#items"),
  langButtons: document.querySelectorAll("[data-lang]")
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function decodeHtml(value = "") {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function label(value, lang = state.lang) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || value.zh || value.es || "";
}

function localizedField(value, lang = state.lang) {
  if (!value) return { text: "", pending: false };
  if (typeof value === "string") return { text: value, pending: false };
  const wanted = value[lang];
  if (wanted) return { text: wanted, pending: false };
  return {
    text: value.original || value.en || "",
    pending: lang !== "en"
  };
}

function activeSection() {
  return state.data.sections.find((section) => section.id === state.sectionId) || state.data.sections[0];
}

function formatDate(value) {
  if (!value) return "Undated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Undated";
  return new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : state.lang === "es" ? "es-ES" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function summaryFor(item) {
  return localizedField(item.summary);
}

function sourcePlatform(source = {}) {
  const raw = decodeHtml(source.name || source.id || "Source").trim();
  const rules = [
    [/^BBC\b/i, "BBC"],
    [/^The New York Times\b/i, "The New York Times"],
    [/^Wall Street Journal\b/i, "Wall Street Journal"],
    [/^Bloomberg\b/i, "Bloomberg"],
    [/^SCMP\b/i, "SCMP"],
    [/^Reuters\b/i, "Reuters"],
    [/^AP\b/i, "AP News"],
    [/^Caixin\b/i, "Caixin"],
    [/^NPR\b/i, "NPR"],
    [/^GitHub\b/i, "GitHub"],
    [/^X\b/i, "X"],
    [/^AI Engineer/i, "AI Engineer"],
    [/^Spanish Language Coach/i, "Spanish Language Coach"],
    [/^Bilibili\b/i, "Bilibili"]
  ];
  const match = rules.find(([pattern]) => pattern.test(raw));
  const name = match ? match[1] : raw.replace(/\s+(World|Business|Markets|Technology|Tech|News|China Economy)$/i, "");
  return {
    id: `platform:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name
  };
}

function sourceGroups(section) {
  const groups = new Map();
  for (const item of section.items || []) {
    const platform = sourcePlatform(item.source);
    const group = groups.get(platform.id) || {
      id: platform.id,
      name: platform.name,
      itemCount: 0,
      sourceIds: new Set(),
      sourceNames: new Set()
    };
    group.itemCount++;
    group.sourceIds.add(item.source.id);
    group.sourceNames.add(item.source.name);
    groups.set(platform.id, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      sourceCount: group.sourceIds.size,
      sourceIds: [...group.sourceIds],
      sourceNames: [...group.sourceNames]
    }))
    .sort((a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name));
}

function filteredItems(section) {
  const q = state.query.trim().toLowerCase();
  return (section.items || []).filter((item) => {
    const platform = sourcePlatform(item.source);
    const sourceOk = state.sourceId === "all" || platform.id === state.sourceId;
    const topicOk = state.topic === "all" || (item.topics || []).includes(state.topic);
    const haystack = [
      typeof item.title === "string" ? item.title : Object.values(item.title || {}).join(" "),
      item.source.name,
      platform.name,
      ...(item.topics || []),
      Object.values(item.summary || {}).join(" ")
    ].join(" ").toLowerCase();
    const queryOk = !q || haystack.includes(q);
    return sourceOk && topicOk && queryOk;
  });
}

function renderTabs() {
  els.tabs.innerHTML = state.data.sections.map((section) => `
    <button class="tabButton ${section.id === state.sectionId ? "active" : ""}" type="button" data-section="${escapeHtml(section.id)}">
      ${escapeHtml(label(section.label))}
      <span class="tabCount">${section.count}</span>
    </button>
  `).join("");

  els.tabs.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sectionId = button.dataset.section;
      state.sourceId = "all";
      state.topic = "all";
      render();
    });
  });
}

function renderFilters(section) {
  const sources = sourceGroups(section);
  const topics = [...new Set((section.items || []).flatMap((item) => item.topics || []))].sort();

  els.sourceFilters.innerHTML = sources.length ? sources.map((source) => `
    <button class="filterButton sourceButton ${source.id === state.sourceId ? "active" : ""}" type="button" data-source="${escapeHtml(source.id)}" title="${escapeHtml(source.sourceNames.join(", "))}">
      <span>${escapeHtml(source.name)}</span>
      <span>${source.itemCount}${source.sourceCount > 1 ? ` · ${source.sourceCount} feeds` : ""}</span>
    </button>
  `).join("") : "<span class=\"sectionDescription\">No sources configured.</span>";

  els.topicFilters.innerHTML = topics.length ? topics.map((topic) => `
    <button class="filterButton ${topic === state.topic ? "active" : ""}" type="button" data-topic="${escapeHtml(topic)}">
      ${escapeHtml(topic)}
    </button>
  `).join("") : "<span class=\"sectionDescription\">No topics yet.</span>";

  els.sourceFilters.querySelectorAll("[data-source]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sourceId = button.dataset.source;
      render();
    });
  });

  els.topicFilters.querySelectorAll("[data-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      state.topic = button.dataset.topic;
      render();
    });
  });
}

function renderHealth(section) {
  const groups = sourceGroups(section);
  const failedIds = new Set((section.sources || []).filter((source) => !source.ok).map((source) => source.id));
  const sources = groups.map((group) => ({
    ...group,
    ok: !group.sourceIds.some((id) => failedIds.has(id)),
    error: group.sourceNames.join(", ")
  }));
  els.sourceHealth.innerHTML = sources.length ? sources.map((source) => `
    <div class="healthItem" title="${escapeHtml(source.error || "OK")}">
      <span class="healthDot ${source.ok ? "" : "failed"}"></span>
      <span>${escapeHtml(source.name)}</span>
      <span>${source.ok ? `${source.itemCount} items` : "failed"}</span>
    </div>
  `).join("") : "<span class=\"sectionDescription\">Waiting for adapters.</span>";
}

function renderItems(items) {
  els.emptyState.hidden = items.length > 0;
  els.items.innerHTML = items.map((item) => {
    const summary = summaryFor(item);
    const title = localizedField(item.title);
    const source = decodeHtml(item.source.name);
    return `
      <article class="item">
        <div class="itemMeta">
          <span class="sourceBadge">${escapeHtml(source)}</span>
          <span>${escapeHtml(formatDate(item.publishedAt))}</span>
          <span>${escapeHtml(item.language?.toUpperCase() || "EN")}</span>
        </div>
        <a class="itemTitle" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
          ${escapeHtml(decodeHtml(title.text))}
          ${title.pending ? "<span class=\"translationNote\">Translation pending</span>" : ""}
        </a>
        <p class="summary">
          ${escapeHtml(decodeHtml(summary.text))}
          ${summary.pending ? "<span class=\"translationNote\">Translation pending</span>" : ""}
        </p>
        <div class="topics">
          ${(item.topics || []).map((topic) => `<span class="topic">${escapeHtml(topic)}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function render() {
  const section = activeSection();
  const items = filteredItems(section);
  const generated = state.data.generatedAt ? formatDate(state.data.generatedAt) : "not generated";
  const failed = (state.data.sourceResults || []).filter((source) => !source.ok).length;

  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : state.lang === "es" ? "es" : "en";
  els.status.textContent = `Updated ${generated} · ${failed ? `${failed} source issue${failed > 1 ? "s" : ""}` : "all sources healthy"}`;
  els.sectionDescription.textContent = section.description || "";
  els.resultTitle.textContent = label(section.label);
  els.resultCount.textContent = `${items.length} of ${section.count} items`;
  els.clearSource.disabled = state.sourceId === "all";
  els.clearTopic.disabled = state.topic === "all";

  renderTabs();
  renderFilters(section);
  renderHealth(section);
  renderItems(items);
}

async function load() {
  try {
    const response = await fetch("../data/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    render();
  } catch (error) {
    els.status.textContent = `Could not load data: ${error.message}`;
    els.emptyState.hidden = false;
    els.emptyState.querySelector("strong").textContent = "Data unavailable.";
  }
}

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.clearSource.addEventListener("click", () => {
  state.sourceId = "all";
  render();
});

els.clearTopic.addEventListener("click", () => {
  state.topic = "all";
  render();
});

els.langButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.lang = button.dataset.lang;
    els.langButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
    render();
  });
});

load();
