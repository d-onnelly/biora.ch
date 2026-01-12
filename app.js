// app.js
(function () {
  const LS_KEY = "biora_notebook_state_v1";

  const els = {
    year: document.getElementById("year"),
    topicList: document.getElementById("topicList"),
    searchInput: document.getElementById("searchInput"),
    clearSearch: document.getElementById("clearSearch"),
    randomBtn: document.getElementById("randomBtn"),

    tabUseful: document.getElementById("tabUseful"),
    tabFun: document.getElementById("tabFun"),
    panelUseful: document.getElementById("panelUseful"),
    panelFun: document.getElementById("panelFun"),

    usefulCards: document.getElementById("usefulCards"),
    funCards: document.getElementById("funCards"),
    usefulCount: document.getElementById("usefulCount"),
    funCount: document.getElementById("funCount"),

    modal: document.getElementById("projectModal"),
    modalContent: document.getElementById("modalContent"),
    modalActions: document.getElementById("modalActions"),
    modalClose: document.getElementById("modalClose"),

    toast: document.getElementById("toast"),

    aboutLink: document.getElementById("aboutLink"),
    contactLink: document.getElementById("contactLink"),
    cvLink: document.getElementById("cvLink"),
    copyEmail: document.getElementById("copyEmail")
  };

  const PROJECTS = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];

  const state = loadState();

  init();

  function init() {
    els.year.textContent = String(new Date().getFullYear());

    // Default state
    if (!state.topic) state.topic = "All";
    if (!state.tab) state.tab = "useful";
    if (typeof state.query !== "string") state.query = "";

    // Search UI
    els.searchInput.value = state.query;
    els.searchInput.addEventListener("input", () => {
      state.query = els.searchInput.value.trim();
      persist();
      render();
    });
    els.clearSearch.addEventListener("click", () => {
      state.query = "";
      els.searchInput.value = "";
      persist();
      render();
      els.searchInput.focus();
    });

    // Tabs
    els.tabUseful.addEventListener("click", () => setTab("useful"));
    els.tabFun.addEventListener("click", () => setTab("fun"));

    // Random
    els.randomBtn.addEventListener("click", () => {
      const visible = getFilteredProjects();
      if (!visible.length) return toast("No projects in current filter.");
      const pick = visible[Math.floor(Math.random() * visible.length)];
      openProject(pick);
    });

    // Modal
    els.modalClose.addEventListener("click", closeModal);
    els.modal.addEventListener("click", (e) => {
      const rect = els.modal.getBoundingClientRect();
      const inDialog =
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
      if (!inDialog) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.modal.open) closeModal();
    });

    // Footer / links (wire up later)
    els.aboutLink.addEventListener("click", (e) => {
      e.preventDefault();
      toast("Coming soon...");
    });
    els.contactLink.addEventListener("click", (e) => {
      e.preventDefault();
      toast("Contact: update email/social links in app.js.");
    });
    els.cvLink.addEventListener("click", (e) => {
      e.preventDefault();
      toast("CV: add assets/cv.pdf and point this link to it.");
    });

    els.copyEmail.addEventListener("click", (e) => {
      e.preventDefault();
      // Change to your email
      copyToClipboard("");
    });

    render();
    setTab(state.tab, { silent: true });
  }

  function render() {
    renderTopics();
    renderBoards();
  }

  function renderTopics() {
    const topics = buildTopicCounts(PROJECTS);

    els.topicList.innerHTML = "";
    topics.forEach(({ topic, count }) => {
      const li = document.createElement("li");
      li.className = "topic" + (state.topic === topic ? " is-active" : "");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", state.topic === topic ? "true" : "false");
      li.tabIndex = 0;

      li.innerHTML = `
        <span>${escapeHtml(topic)}</span>
        <small>${count}</small>
      `;

      li.addEventListener("click", () => {
        state.topic = topic;
        persist();
        render();
      });

      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          state.topic = topic;
          persist();
          render();
        }
      });

      els.topicList.appendChild(li);
    });
  }

  function renderBoards() {
    const filtered = getFilteredProjects();

    const useful = filtered.filter(p => p.type === "useful");
    const fun = filtered.filter(p => p.type === "fun");

    els.usefulCount.textContent = metaText(useful.length);
    els.funCount.textContent = metaText(fun.length);

    els.usefulCards.innerHTML = "";
    useful.forEach((p, idx) => els.usefulCards.appendChild(projectCard(p, idx)));

    els.funCards.innerHTML = "";
    fun.forEach((p, idx) => els.funCards.appendChild(projectCard(p, idx)));
  }

  function projectCard(project, idx) {
    const card = document.createElement("article");
    card.className = "card";
    card.style.setProperty("--tilt", tiltFor(idx));
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open project: ${project.title}`);

    const pinned = project.links && (project.links.live || project.links.repo) ? `<span class="pinned" aria-hidden="true"></span>` : "";

    card.innerHTML = `
      ${pinned}
      <h3 class="card__title">${escapeHtml(project.title)}</h3>
      <p class="card__desc">${escapeHtml(truncateWords(project.summary || "", 30))}</p>
      <div class="badges">
        ${(project.tech || []).slice(0, 6).map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("")}
      </div>
      <div class="card__footer">
        <span>${escapeHtml(project.topic || "Misc")}</span>
        <span>${escapeHtml(project.status || "")}</span>
      </div>
    `;

    card.addEventListener("click", () => openProject(project));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProject(project);
      }
    });

    return card;
  }

  function openProject(project) {
    els.modalContent.innerHTML = `
      <h3>${escapeHtml(project.title)}</h3>
      <p class="muted">${escapeHtml(project.topic || "")} • ${escapeHtml(project.type || "")} • ${escapeHtml(project.status || "")}</p>
      <p>${escapeHtml(project.summary || "")}</p>
      ${Array.isArray(project.details) && project.details.length ? `
        <div style="margin-top:10px">
          <p style="margin:0 0 6px; font-weight:700;">Notes</p>
          <ul style="margin:0; padding-left:18px;">
            ${project.details.map(x => `<li>${escapeHtml(x)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${(project.tech || []).length ? `
        <div style="margin-top:12px">
          <p style="margin:0 0 6px; font-weight:700;">Tech</p>
          <div class="badges">
            ${(project.tech || []).map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("")}
          </div>
        </div>
      ` : ""}
    `;

    const actions = [];
    const repo = project.links?.repo || "";
    const live = project.links?.live || "";
    const custom = project.links?.custom || "";

    if (live) actions.push(actionLink("Live demo", live));
    if (repo) actions.push(actionLink("Repository", repo));
    if (custom) actions.push(actionLink("Custom", custom));

    actions.push(`<button class="btn" type="button" id="copyTitleBtn">Copy title</button>`);
    els.modalActions.innerHTML = actions.join("");

    const copyTitleBtn = document.getElementById("copyTitleBtn");
    if (copyTitleBtn) {
      copyTitleBtn.addEventListener("click", () => copyToClipboard(project.title));
    }

    if (!els.modal.open) els.modal.showModal();
  }

  function closeModal() {
    if (els.modal.open) els.modal.close();
  }

  function setTab(tab, opts = {}) {
    state.tab = tab;
    if (!opts.silent) persist();

    const usefulActive = tab === "useful";

    els.tabUseful.classList.toggle("is-active", usefulActive);
    els.tabFun.classList.toggle("is-active", !usefulActive);
    els.tabUseful.setAttribute("aria-selected", usefulActive ? "true" : "false");
    els.tabFun.setAttribute("aria-selected", !usefulActive ? "true" : "false");

    els.panelUseful.classList.toggle("is-active", usefulActive);
    els.panelFun.classList.toggle("is-active", !usefulActive);
  }

  function getFilteredProjects() {
    const q = (state.query || "").toLowerCase();
    const topic = state.topic || "All";

    return PROJECTS.filter(p => {
      const topicOk = topic === "All" ? true : (p.topic === topic);
      if (!topicOk) return false;

      if (!q) return true;

      const hay = [
        p.title,
        p.summary,
        p.topic,
        p.status,
        ...(p.tech || []),
        ...(p.details || [])
      ].filter(Boolean).join(" ").toLowerCase();

      return hay.includes(q);
    });
  }

  function buildTopicCounts(projects) {
    const counts = new Map();
    counts.set("All", projects.length);

    for (const p of projects) {
      const t = p.topic || "Misc";
      counts.set(t, (counts.get(t) || 0) + 1);
    }

    // Order to match your sketch-ish: key topics first, then remaining alpha
    const preferred = [
      "All",
      "Websites",
      "Software Applications",
      "3D Modelling",
      "Lua Programming",
      "Miscellaneous",
      "Embedded Programming"
    ];

    const rest = Array.from(counts.keys())
      .filter(k => !preferred.includes(k))
      .sort((a,b) => a.localeCompare(b));

    const ordered = preferred.filter(k => counts.has(k)).concat(rest);

    return ordered.map(topic => ({ topic, count: counts.get(topic) || 0 }));
  }

  function metaText(n) {
    if (n === 0) return "No matches";
    if (n === 1) return "1 project";
    return `${n} projects`;
  }

  function actionLink(label, href) {
    const safe = escapeAttr(href);
    return `<a class="btn" href="${safe}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
  }

  function tiltFor(i) {
    const tilts = ["-0.6deg", "0.4deg", "-0.2deg", "0.7deg", "-0.4deg", "0.2deg"];
    return tilts[i % tilts.length];
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("is-show");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => els.toast.classList.remove("is-show"), 1400);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied.");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Copied.");
    }
  }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    // Basic attribute escaping; also blocks javascript: schemes
    const v = String(s || "").trim();
    if (/^javascript:/i.test(v)) return "";
    return escapeHtml(v);
  }

  function truncateWords(text, maxWords = 30) {
    const words = String(text).split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(" ") + "…";
  }


})();
