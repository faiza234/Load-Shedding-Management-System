/* ============================================================================
   Load Shedding Management System — Dashboard Script
   CRUD + search/filter/sort support for every management section.
   ============================================================================ */

document.addEventListener("DOMContentLoaded", () => {
  if (!Auth.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  const currentUser = Auth.getUser() || { user_id: 0, user_name: "Guest", role: "officer" };
  const isAdmin = currentUser.role === "admin";
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  document.getElementById("user-name").textContent = currentUser.user_name;
  document.getElementById("user-role").textContent = currentUser.role;
  document.getElementById("user-avatar").textContent = currentUser.user_name.charAt(0).toUpperCase();
  document.getElementById("logout-btn").addEventListener("click", (event) => {
    event.preventDefault();
    Auth.logout();
  });

  // -------------------------------------------------------------------------
  // Shared state
  // -------------------------------------------------------------------------
  let allAreas = [];
  let dailyFrequencyRows = [];
  let complaintRows = [];
  let scheduleRows = [];
  let highRiskRows = [];
  let analysisRows = [];
  let actionRows = [];
  let userRows = [];

  let chartDivision = null;
  let chartDailyCount = null;
  let chartDailyDuration = null;
  let chartAnalysis = null;

  const byId = (id) => document.getElementById(id);
  const num = (value) => Number(value || 0);
  const safeLower = (value) => String(value ?? "").toLowerCase();

  function showFormError(id, message = "") {
    const box = byId(id);
    if (!box) return;
    box.textContent = message;
    box.style.display = message ? "block" : "none";
  }

  function openModal(id) {
    byId(id)?.classList.add("open");
  }

  function closeModal(id) {
    byId(id)?.classList.remove("open");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return String(value).replace("T", " ").slice(0, 19);
  }

  function compareValues(a, b, key, direction = "asc") {
    let av = a[key];
    let bv = b[key];

    const numericKeys = new Set([
      "area_id", "frequency_id", "complaint_id", "schedule_id", "zone_id",
      "analysis_id", "action_id", "user_id", "outage_count", "total_outage_hours",
      "duration_hours", "month", "year", "outage_percentage", "total_outages",
      "assigned"
    ]);

    let result;
    if (numericKeys.has(key)) {
      result = num(av) - num(bv);
    } else {
      result = String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });
    }
    return direction === "desc" ? -result : result;
  }

  function sortWithSpec(rows, spec, special = {}) {
    const copy = [...rows];
    if (special[spec]) return copy.sort(special[spec]);
    const [key, direction = "asc"] = String(spec || "").split(":");
    return copy.sort((a, b) => compareValues(a, b, key, direction));
  }

  function setSelectOptions(id, options, placeholder = "Select...") {
    const select = byId(id);
    if (!select) return;
    const oldValue = select.value;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + options;
    if ([...select.options].some((option) => option.value === oldValue)) {
      select.value = oldValue;
    }
  }

  function areaOptions() {
    return allAreas
      .map((area) => `<option value="${area.area_id}">${escapeHtml(area.area_name)} (${escapeHtml(area.division)})</option>`)
      .join("");
  }

  function populateAreaDropdowns() {
    const configurations = {
      "dailyfreq-area-filter": "All districts",
      "dailyfreq-area": "Select district...",
      "complaint-area-filter": "All areas",
      "complaint-create-area": "Select area...",
      "schedule-area-filter": "All areas",
      "schedule-area": "Select area...",
      "highrisk-area": "Select area...",
      "analysis-area-filter": "All areas",
      "analysis-area": "Select area...",
      "action-area": "Select area...",
      "action-area-filter": "All areas",
    };

    const options = areaOptions();
    Object.entries(configurations).forEach(([id, placeholder]) => {
      setSelectOptions(id, options, placeholder);
    });
  }

  async function ensureAreasLoaded(force = false) {
    if (!force && allAreas.length) return allAreas;
    allAreas = await api("/areas");
    populateAreaDropdowns();
    populateAreaDivisionControls();
    return allAreas;
  }

  async function refreshAreas() {
    await ensureAreasLoaded(true);
    renderAreasTable();
  }

  // Close modals when clicking the backdrop or pressing Escape.
  document.querySelectorAll(".modal-backdrop").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.classList.remove("open");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach((modal) => modal.classList.remove("open"));
    }
  });

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  const navItems = [...document.querySelectorAll(".nav-item")];
  const sectionInfo = {
    overview: ["Overview", "National snapshot across all districts"],
    dailyfreq: ["Daily Outage Frequency Tracker", "Create, edit, filter and sort daily outage records"],
    areas: ["District Areas", "Manage districts, divisions and region classifications"],
    complaints: ["Citizen Complaints", "Create, update, filter and resolve citizen reports"],
    schedules: ["Outage Schedules", "Manage planned load-shedding windows"],
    highrisk: ["High Risk Zones", "View all historical and current risk flags"],
    analysis: ["Monthly Analysis", "Manage historical monthly outage statistics"],
    actions: ["Authority Actions", "Log and manage official operational actions"],
    users: ["Authority Staff Accounts", "Manage users and many-to-many area assignments"],
  };

  navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      switchSection(item.dataset.section);
    });
  });

  async function switchSection(section) {
    navItems.forEach((item) => item.classList.toggle("active", item.dataset.section === section));
    document.querySelectorAll(".section").forEach((element) => {
      element.style.display = element.id === `sec-${section}` ? "block" : "none";
    });

    const [title, description] = sectionInfo[section] || ["Dashboard", ""];
    byId("section-title").textContent = title;
    byId("section-desc").textContent = description;

    try {
      if (section === "overview") await loadOverview();
      if (section === "dailyfreq") await loadDailyFrequency();
      if (section === "areas") await loadAreasSection();
      if (section === "complaints") await loadComplaints();
      if (section === "schedules") await loadSchedules();
      if (section === "highrisk") await loadHighRisk();
      if (section === "analysis") await loadAnalysis();
      if (section === "actions") await loadActions();
      if (section === "users") await loadUsers();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  // -------------------------------------------------------------------------
  // Overview
  // -------------------------------------------------------------------------
  async function loadOverview() {
    await ensureAreasLoaded();
    const summary = await api("/analytics/summary");
    byId("overview-cards").innerHTML = `
      <div class="card accent-amber"><div class="k">Monitored Districts</div><div class="v">${summary.totalAreas ?? summary.totalDistricts ?? allAreas.length}</div></div>
      <div class="card accent-red"><div class="k">Unresolved Complaints</div><div class="v">${summary.openComplaints ?? 0}</div></div>
      <div class="card accent-red"><div class="k">Current High Risk Zones</div><div class="v">${summary.highRiskCount ?? 0}</div></div>
      <div class="card accent-blue"><div class="k">Avg National Outage %</div><div class="v">${summary.avgOutagePct ?? 0}%</div></div>
    `;

    renderDivisionChart(summary.byDivision || []);
    renderTopComplaintAreas(summary.topComplaintAreas || []);
  }

  function renderDivisionChart(rows) {
    const canvas = byId("chart-division");
    if (!canvas || typeof Chart === "undefined") return;
    chartDivision?.destroy();

    chartDivision = new Chart(canvas, {
      type: "bar",
      data: {
        labels: rows.map((row) => row.division),
        datasets: [{
          label: "Average outage %",
          data: rows.map((row) => Number(row.avg_outage_percentage || 0)),
          backgroundColor: "rgba(242, 169, 59, 0.75)",
          borderColor: "#f2a93b",
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: chartOptions(false),
    });
  }

  function renderTopComplaintAreas(rows) {
    const target = byId("top-complaints-list");
    if (!target) return;
    if (!rows.length) {
      target.innerHTML = `<div class="empty-state">No complaint data available.</div>`;
      return;
    }
    target.innerHTML = rows.map((row) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
        <span><strong>${escapeHtml(row.area_name)}</strong><br><small>${escapeHtml(row.division || "")}</small></span>
        <span class="pill pill-open">${row.complaint_count} complaints</span>
      </div>
    `).join("");
  }

  function chartOptions(showLegend = true) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: showLegend, labels: { color: "#e7edf3" } } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#23313f" }, ticks: { color: "#8ca0b3" } },
        x: { grid: { display: false }, ticks: { color: "#8ca0b3" } },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Daily frequency
  // -------------------------------------------------------------------------
  const dailyControls = ["dailyfreq-date-filter", "dailyfreq-area-filter", "dailyfreq-search", "dailyfreq-sort"];
  dailyControls.forEach((id) => {
    byId(id)?.addEventListener(id.includes("search") ? "input" : "change", renderDailyFrequency);
  });

  async function loadDailyFrequency() {
    await ensureAreasLoaded();
    dailyFrequencyRows = await api("/analytics/daily?all=1");
    renderDailyFrequency();
  }

  function renderDailyFrequency() {
    const date = byId("dailyfreq-date-filter")?.value || "";
    const areaId = byId("dailyfreq-area-filter")?.value || "";
    const search = safeLower(byId("dailyfreq-search")?.value).trim();
    const sort = byId("dailyfreq-sort")?.value || "date:desc";

    let rows = dailyFrequencyRows.filter((row) => {
      const matchesDate = !date || row.date === date;
      const matchesArea = !areaId || Number(row.area_id) === Number(areaId);
      const matchesSearch = !search || [row.area_name, row.division, row.region_type].some((value) => safeLower(value).includes(search));
      return matchesDate && matchesArea && matchesSearch;
    });
    rows = sortWithSpec(rows, sort);

    const totalOutages = rows.reduce((sum, row) => sum + num(row.outage_count), 0);
    const totalHours = rows.reduce((sum, row) => sum + num(row.total_outage_hours), 0);
    byId("stat-daily-count").textContent = totalOutages;
    byId("stat-daily-hours").textContent = `${totalHours.toFixed(1)} hrs`;
    byId("stat-daily-avg").textContent = `${(totalOutages ? totalHours / totalOutages : 0).toFixed(2)} hrs`;
    byId("stat-daily-districts").textContent = new Set(rows.map((row) => row.area_id)).size;

    const body = byId("dailyfreq-table-body");
    body.innerHTML = rows.length ? rows.map((row) => `
      <tr>
        <td class="mono">#${row.frequency_id}</td>
        <td>${escapeHtml(row.date)}</td>
        <td><strong>${escapeHtml(row.area_name)}</strong></td>
        <td>${escapeHtml(row.division)}</td>
        <td><span class="pill pill-${safeLower(row.region_type)}">${escapeHtml(row.region_type || "-")}</span></td>
        <td>${row.outage_count}</td>
        <td class="mono">${num(row.total_outage_hours).toFixed(2)} hrs</td>
        <td class="mono">${num(row.avg_outage_duration).toFixed(2)} hrs</td>
        <td><div class="row-actions">
          <button class="btn-sm" onclick="editDailyFrequency(${row.frequency_id})">Edit</button>
          <button class="btn-sm danger" onclick="deleteDailyFrequency(${row.frequency_id})">Delete</button>
        </div></td>
      </tr>
    `).join("") : `<tr><td colspan="9" class="empty-state">No daily-frequency records match the filters.</td></tr>`;

    renderDailyCharts(rows);
  }

  function renderDailyCharts(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
      const key = row.area_name;
      const current = grouped.get(key) || { count: 0, hours: 0 };
      current.count += num(row.outage_count);
      current.hours += num(row.total_outage_hours);
      grouped.set(key, current);
    });

    const labels = [...grouped.keys()];
    const counts = labels.map((label) => grouped.get(label).count);
    const hours = labels.map((label) => grouped.get(label).hours);
    const averages = labels.map((label) => {
      const item = grouped.get(label);
      return item.count ? Number((item.hours / item.count).toFixed(2)) : 0;
    });

    const countCanvas = byId("chart-dailyfreq");
    const durationCanvas = byId("chart-dailyfreq-duration");
    if (!countCanvas || !durationCanvas || typeof Chart === "undefined") return;

    chartDailyCount?.destroy();
    chartDailyDuration?.destroy();
    if (!labels.length) return;

    chartDailyCount = new Chart(countCanvas, {
      type: "bar",
      data: { labels, datasets: [{ label: "Outage count", data: counts, backgroundColor: "rgba(220, 85, 77, 0.8)", borderRadius: 6 }] },
      options: chartOptions(false),
    });
    chartDailyDuration = new Chart(durationCanvas, {
      type: "bar",
      data: { labels, datasets: [
        { label: "Total outage hours", data: hours, backgroundColor: "rgba(242, 169, 59, 0.75)", borderRadius: 6 },
        { label: "Average duration", data: averages, backgroundColor: "rgba(75, 159, 225, 0.75)", borderRadius: 6 },
      ] },
      options: chartOptions(true),
    });
  }

  function updateDailyAveragePreview() {
    const count = num(byId("dailyfreq-count")?.value);
    const hours = num(byId("dailyfreq-total-hours")?.value);
    byId("dailyfreq-avg-preview").value = `${(count ? hours / count : 0).toFixed(2)} hrs/outage`;
  }

  byId("dailyfreq-count")?.addEventListener("input", updateDailyAveragePreview);
  byId("dailyfreq-total-hours")?.addEventListener("input", updateDailyAveragePreview);
  byId("add-dailyfreq-btn")?.addEventListener("click", async () => {
    await ensureAreasLoaded();
    byId("dailyfreq-form").reset();
    byId("dailyfreq-id").value = "";
    byId("dailyfreq-date").value = todayStr;
    byId("dailyfreq-modal-title").textContent = "Record Daily Outage Frequency";
    updateDailyAveragePreview();
    showFormError("dailyfreq-form-error");
    openModal("dailyfreq-modal");
  });
  byId("dailyfreq-cancel-btn")?.addEventListener("click", () => closeModal("dailyfreq-modal"));
  byId("dailyfreq-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFormError("dailyfreq-form-error");
    const id = byId("dailyfreq-id").value;
    const payload = {
      area_id: Number(byId("dailyfreq-area").value),
      date: byId("dailyfreq-date").value,
      outage_count: Number(byId("dailyfreq-count").value),
      total_outage_hours: Number(byId("dailyfreq-total-hours").value),
    };
    try {
      await api(id ? `/analytics/daily/${id}` : "/analytics/daily", { method: id ? "PUT" : "POST", body: payload });
      closeModal("dailyfreq-modal");
      await loadDailyFrequency();
      showToast(id ? "Daily record updated." : "Daily record added.", "success");
    } catch (error) {
      showFormError("dailyfreq-form-error", error.message);
    }
  });

  window.editDailyFrequency = (id) => {
    const row = dailyFrequencyRows.find((item) => Number(item.frequency_id) === Number(id));
    if (!row) return;
    byId("dailyfreq-id").value = row.frequency_id;
    byId("dailyfreq-area").value = row.area_id;
    byId("dailyfreq-date").value = row.date;
    byId("dailyfreq-count").value = row.outage_count;
    byId("dailyfreq-total-hours").value = row.total_outage_hours;
    byId("dailyfreq-modal-title").textContent = "Edit Daily Frequency Record";
    updateDailyAveragePreview();
    showFormError("dailyfreq-form-error");
    openModal("dailyfreq-modal");
  };

  window.deleteDailyFrequency = async (id) => {
    if (!window.confirm("Delete this daily frequency record?")) return;
    try {
      await api(`/analytics/daily/${id}`, { method: "DELETE" });
      await loadDailyFrequency();
      showToast("Daily record deleted.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // -------------------------------------------------------------------------
  // Area management
  // -------------------------------------------------------------------------
  function populateAreaDivisionControls() {
    const divisions = [...new Set(allAreas.map((area) => area.division).filter(Boolean))].sort();
    const divisionFilter = byId("area-division-filter");
    if (divisionFilter) {
      const old = divisionFilter.value;
      divisionFilter.innerHTML = `<option value="">All divisions</option>` + divisions.map((division) => `<option value="${escapeHtml(division)}">${escapeHtml(division)}</option>`).join("");
      if (divisions.includes(old)) divisionFilter.value = old;
    }
    const dataList = byId("division-list");
    if (dataList) dataList.innerHTML = divisions.map((division) => `<option value="${escapeHtml(division)}"></option>`).join("");
  }

  ["area-search", "area-division-filter", "area-region-filter", "area-sort"].forEach((id) => {
    byId(id)?.addEventListener(id === "area-search" ? "input" : "change", renderAreasTable);
  });

  async function loadAreasSection() {
    await ensureAreasLoaded();
    renderAreasTable();
  }

  function renderAreasTable() {
    const table = byId("area-table");
    if (!table) return;
    const search = safeLower(byId("area-search")?.value).trim();
    const division = byId("area-division-filter")?.value || "";
    const region = byId("area-region-filter")?.value || "";
    const sort = byId("area-sort")?.value || "division:asc";

    let rows = allAreas.filter((row) => {
      const matchesSearch = !search || [row.area_name, row.division, row.region_type, row.zip_code].some((value) => safeLower(value).includes(search));
      return matchesSearch && (!division || row.division === division) && (!region || row.region_type === region);
    });
    rows = sortWithSpec(rows, sort);

    table.innerHTML = `
      <thead><tr><th>ID</th><th>District Name</th><th>Division</th><th>Region Type</th><th>Zip Code</th><th>Actions</th></tr></thead>
      <tbody>${rows.length ? rows.map((row) => `
        <tr>
          <td class="mono">#${row.area_id}</td>
          <td><strong>${escapeHtml(row.area_name)}</strong></td>
          <td>${escapeHtml(row.division)}</td>
          <td><span class="pill pill-${safeLower(row.region_type)}">${escapeHtml(row.region_type)}</span></td>
          <td class="mono">${escapeHtml(row.zip_code || "-")}</td>
          <td><div class="row-actions">
            <button class="btn-sm" onclick="editArea(${row.area_id})">Edit</button>
            <button class="btn-sm danger" onclick="deleteArea(${row.area_id})">Delete</button>
          </div></td>
        </tr>
      `).join("") : `<tr><td colspan="6" class="empty-state">No areas match the filters.</td></tr>`}</tbody>`;
  }

  function openAreaEditor(row = null) {
    byId("area-form").reset();
    byId("area-id").value = row?.area_id || "";
    byId("area-name").value = row?.area_name || "";
    byId("area-division").value = row?.division || "";
    byId("area-region").value = row?.region_type || "Urban";
    byId("area-zip").value = row?.zip_code || "";
    byId("area-modal-title").textContent = row ? "Edit Area" : "Add Area";
    showFormError("area-form-error");
    openModal("area-modal");
  }

  byId("add-area-btn")?.addEventListener("click", () => openAreaEditor());
  byId("area-cancel-btn")?.addEventListener("click", () => closeModal("area-modal"));
  byId("area-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = byId("area-id").value;
    const payload = {
      area_name: byId("area-name").value.trim(),
      division: byId("area-division").value.trim(),
      region_type: byId("area-region").value,
      zip_code: byId("area-zip").value.trim(),
    };
    try {
      await api(id ? `/areas/${id}` : "/areas", { method: id ? "PUT" : "POST", body: payload });
      closeModal("area-modal");
      await refreshAreas();
      showToast(id ? "Area updated." : "Area added.", "success");
    } catch (error) {
      showFormError("area-form-error", error.message);
    }
  });

  window.editArea = (id) => openAreaEditor(allAreas.find((row) => Number(row.area_id) === Number(id)));
  window.deleteArea = async (id) => {
    const row = allAreas.find((item) => Number(item.area_id) === Number(id));
    if (!row) return;
    if (!window.confirm(`Delete ${row.area_name}? Related records may also be removed because of cascading foreign keys.`)) return;
    try {
      await api(`/areas/${id}`, { method: "DELETE" });
      await refreshAreas();
      showToast("Area deleted.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // -------------------------------------------------------------------------
  // Complaints
  // -------------------------------------------------------------------------
  ["complaint-search", "complaint-area-filter", "complaint-status-filter", "complaint-sort"].forEach((id) => {
    byId(id)?.addEventListener(id === "complaint-search" ? "input" : "change", renderComplaints);
  });

  async function loadComplaints() {
    await ensureAreasLoaded();
    complaintRows = await api("/complaints");
    renderComplaints();
  }

  function renderComplaints() {
    const search = safeLower(byId("complaint-search")?.value).trim();
    const areaId = byId("complaint-area-filter")?.value || "";
    const status = byId("complaint-status-filter")?.value || "";
    const sort = byId("complaint-sort")?.value || "reported_at:desc";

    let rows = complaintRows.filter((row) => {
      const name = row.full_name || row.citizen_name || "Citizen";
      const matchesSearch = !search || [row.description, name, row.phone, row.citizen_phone, row.area_name].some((value) => safeLower(value).includes(search));
      return matchesSearch && (!areaId || Number(row.area_id) === Number(areaId)) && (!status || row.status === status);
    });
    rows = sortWithSpec(rows, sort);

    const groups = {
      open: rows.filter((row) => row.status === "open"),
      in_review: rows.filter((row) => row.status === "in_review"),
      history: rows.filter((row) => row.status === "resolved" || row.status === "rejected"),
    };

    byId("count-open").textContent = groups.open.length;
    byId("count-review").textContent = groups.in_review.length;
    byId("count-history").textContent = groups.history.length;

    const renderCard = (row) => {
      const name = row.full_name || row.citizen_name || "Citizen";
      return `
        <div class="kanban-complaint-card">
          <div class="card-top"><span class="card-id-tag">#${row.complaint_id}</span><span class="card-area-badge">${escapeHtml(row.area_name)}</span></div>
          <div class="card-citizen-info">${escapeHtml(name)}</div>
          <div class="card-description">${escapeHtml(row.description)}</div>
          <div class="card-meta-row"><span>📅 ${escapeHtml(formatDateTime(row.reported_at))}</span><span class="pill pill-${row.status}">${escapeHtml(row.status)}</span></div>
          ${row.resolution_note ? `<div class="text-muted" style="margin-top:8px;font-size:12px;">${escapeHtml(row.resolution_note)}</div>` : ""}
          <div class="row-actions" style="margin-top:10px;flex-wrap:wrap;">
            <button class="btn-sm" onclick="updateComplaint(${row.complaint_id})">Update</button>
            <button class="btn-sm" onclick="openGuidedAction(${row.complaint_id})">Take action</button>
            <button class="btn-sm danger" onclick="deleteComplaint(${row.complaint_id})">Delete</button>
          </div>
        </div>`;
    };

    byId("kanban-col-open").innerHTML = groups.open.length ? groups.open.map(renderCard).join("") : `<div class="empty-state">No open complaints.</div>`;
    byId("kanban-col-review").innerHTML = groups.in_review.length ? groups.in_review.map(renderCard).join("") : `<div class="empty-state">No complaints in review.</div>`;
    byId("kanban-col-history").innerHTML = groups.history.length ? groups.history.map(renderCard).join("") : `<div class="empty-state">No closed complaint history.</div>`;
  }

  byId("add-complaint-btn")?.addEventListener("click", () => {
    byId("complaint-create-form").reset();
    showFormError("complaint-create-error");
    openModal("complaint-create-modal");
  });
  byId("complaint-create-cancel-btn")?.addEventListener("click", () => closeModal("complaint-create-modal"));
  byId("complaint-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      full_name: byId("complaint-create-name").value.trim(),
      phone: byId("complaint-create-phone").value.trim(),
      email: byId("complaint-create-email").value.trim(),
      area_id: Number(byId("complaint-create-area").value),
      description: byId("complaint-create-description").value.trim(),
    };
    try {
      await api("/complaints", { method: "POST", body: payload });
      closeModal("complaint-create-modal");
      await loadComplaints();
      showToast("Complaint added.", "success");
    } catch (error) {
      showFormError("complaint-create-error", error.message);
    }
  });

  window.updateComplaint = (id) => {
    const row = complaintRows.find((item) => Number(item.complaint_id) === Number(id));
    if (!row) return;
    byId("complaint-id").value = row.complaint_id;
    byId("complaint-status").value = row.status;
    byId("complaint-note").value = row.resolution_note || "";
    byId("complaint-modal-sub").textContent = `${row.area_name} — ${row.full_name || row.citizen_name || "Citizen"}`;
    showFormError("complaint-form-error");
    openModal("complaint-modal");
  };
  byId("complaint-cancel-btn")?.addEventListener("click", () => closeModal("complaint-modal"));
  byId("complaint-status-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = byId("complaint-id").value;
    try {
      await api(`/complaints/${id}`, {
        method: "PUT",
        body: { status: byId("complaint-status").value, resolution_note: byId("complaint-note").value.trim() },
      });
      closeModal("complaint-modal");
      await loadComplaints();
      showToast("Complaint updated.", "success");
    } catch (error) {
      showFormError("complaint-form-error", error.message);
    }
  });

  window.deleteComplaint = async (id) => {
    if (!window.confirm("Delete this complaint and unlink its related action references?")) return;
    try {
      await api(`/complaints/${id}`, { method: "DELETE" });
      await loadComplaints();
      showToast("Complaint deleted.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  window.openGuidedAction = (id) => {
    const row = complaintRows.find((item) => Number(item.complaint_id) === Number(id));
    if (!row) return;
    const step = row.recommended_step || {};
    byId("guidance-complaint-id").value = row.complaint_id;
    byId("guidance-area-id").value = row.area_id;
    byId("guidance-sub").textContent = `Complaint #${row.complaint_id} · ${row.area_name}`;
    byId("guidance-complaint-summary").innerHTML = `<strong>${escapeHtml(row.full_name || row.citizen_name || "Citizen")}</strong><p>${escapeHtml(row.description)}</p>`;
    byId("sop-category-pill").textContent = step.category || "General Outage";
    byId("sop-urgency-pill").textContent = `${step.urgency || "Normal"} urgency`;
    byId("sop-action-heading").textContent = `Recommended step: ${step.recommendedAction || "Site Inspection"}`;
    byId("sop-action-desc").textContent = step.suggestedStep || "Review the complaint and conduct an area inspection.";
    byId("guidance-action-type").value = step.recommendedAction || "Site Inspection";
    byId("guidance-target-status").value = step.targetStatus || "in_review";
    byId("guidance-action-notes").value = step.suggestedStep || "";
    openModal("action-guidance-modal");
  };
  byId("guidance-close-btn")?.addEventListener("click", () => closeModal("action-guidance-modal"));
  byId("guidance-cancel-btn")?.addEventListener("click", () => closeModal("action-guidance-modal"));
  byId("guidance-action-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const complaintId = Number(byId("guidance-complaint-id").value);
    try {
      await api("/actions", {
        method: "POST",
        body: {
          area_id: Number(byId("guidance-area-id").value),
          complaint_id: complaintId,
          action_type: byId("guidance-action-type").value,
          notes: byId("guidance-action-notes").value.trim(),
        },
      });
      await api(`/complaints/${complaintId}`, {
        method: "PUT",
        body: { status: byId("guidance-target-status").value },
      });
      closeModal("action-guidance-modal");
      await loadComplaints();
      showToast("Action logged and complaint status updated.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  // -------------------------------------------------------------------------
  // Outage schedules
  // -------------------------------------------------------------------------
  ["schedule-search", "schedule-area-filter", "schedule-from", "schedule-to", "schedule-sort"].forEach((id) => {
    byId(id)?.addEventListener(id === "schedule-search" ? "input" : "change", renderSchedules);
  });

  async function loadSchedules() {
    await ensureAreasLoaded();
    scheduleRows = await api("/schedules");
    renderSchedules();
  }

  function renderSchedules() {
    const search = safeLower(byId("schedule-search")?.value).trim();
    const areaId = byId("schedule-area-filter")?.value || "";
    const from = byId("schedule-from")?.value || "";
    const to = byId("schedule-to")?.value || "";
    const sort = byId("schedule-sort")?.value || "schedule_date:desc";

    let rows = scheduleRows.filter((row) => {
      const matchesSearch = !search || [row.area_name, row.division, row.reason, row.created_by_name].some((value) => safeLower(value).includes(search));
      return matchesSearch && (!areaId || Number(row.area_id) === Number(areaId)) && (!from || row.schedule_date >= from) && (!to || row.schedule_date <= to);
    });
    rows = sortWithSpec(rows, sort);

    byId("schedule-table").innerHTML = `
      <thead><tr><th>ID</th><th>District Area</th><th>Date</th><th>Start</th><th>End</th><th>Duration</th><th>Reason</th><th>Actions</th></tr></thead>
      <tbody>${rows.length ? rows.map((row) => `
        <tr>
          <td class="mono">#${row.schedule_id}</td>
          <td><strong>${escapeHtml(row.area_name)}</strong><br><small>${escapeHtml(row.division || "")}</small></td>
          <td>${escapeHtml(row.schedule_date)}</td>
          <td class="mono">${escapeHtml(row.start_time)}</td>
          <td class="mono">${escapeHtml(row.end_time)}</td>
          <td class="mono">${num(row.duration_hours).toFixed(1)} hrs</td>
          <td>${escapeHtml(row.reason || "-")}</td>
          <td><div class="row-actions">
            <button class="btn-sm" onclick="editSchedule(${row.schedule_id})">Edit</button>
            <button class="btn-sm danger" onclick="deleteSchedule(${row.schedule_id})">Delete</button>
          </div></td>
        </tr>
      `).join("") : `<tr><td colspan="8" class="empty-state">No schedules match the filters.</td></tr>`}</tbody>`;
  }

  function calculateScheduleDuration() {
    const start = byId("schedule-start")?.value;
    const end = byId("schedule-end")?.value;
    if (!start || !end) return;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let minutes = eh * 60 + em - (sh * 60 + sm);
    if (minutes <= 0) minutes += 24 * 60;
    byId("schedule-duration").value = (minutes / 60).toFixed(1);
  }
  byId("schedule-start")?.addEventListener("change", calculateScheduleDuration);
  byId("schedule-end")?.addEventListener("change", calculateScheduleDuration);

  function openScheduleEditor(row = null) {
    byId("schedule-form").reset();
    byId("schedule-id").value = row?.schedule_id || "";
    byId("schedule-area").value = row?.area_id || "";
    byId("schedule-date").value = row?.schedule_date || todayStr;
    byId("schedule-start").value = String(row?.start_time || "09:00").slice(0, 5);
    byId("schedule-end").value = String(row?.end_time || "11:00").slice(0, 5);
    byId("schedule-duration").value = row?.duration_hours || "2.0";
    byId("schedule-reason").value = row?.reason || "";
    byId("schedule-modal-title").textContent = row ? "Edit Outage Schedule" : "New Outage Schedule";
    showFormError("schedule-form-error");
    openModal("schedule-modal");
  }

  byId("add-schedule-btn")?.addEventListener("click", () => openScheduleEditor());
  byId("schedule-cancel-btn")?.addEventListener("click", () => closeModal("schedule-modal"));
  byId("schedule-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = byId("schedule-id").value;
    const payload = {
      area_id: Number(byId("schedule-area").value),
      schedule_date: byId("schedule-date").value,
      start_time: byId("schedule-start").value,
      end_time: byId("schedule-end").value,
      duration_hours: Number(byId("schedule-duration").value),
      reason: byId("schedule-reason").value.trim(),
    };
    try {
      await api(id ? `/schedules/${id}` : "/schedules", { method: id ? "PUT" : "POST", body: payload });
      closeModal("schedule-modal");
      await loadSchedules();
      showToast(id ? "Schedule updated." : "Schedule added.", "success");
    } catch (error) {
      showFormError("schedule-form-error", error.message);
    }
  });
  window.editSchedule = (id) => openScheduleEditor(scheduleRows.find((row) => Number(row.schedule_id) === Number(id)));
  window.deleteSchedule = async (id) => {
    if (!window.confirm("Delete this outage schedule?")) return;
    try {
      await api(`/schedules/${id}`, { method: "DELETE" });
      await loadSchedules();
      showToast("Schedule deleted.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // -------------------------------------------------------------------------
  // High-risk zones (all historical rows, not only latest view)
  // -------------------------------------------------------------------------
  ["highrisk-search", "highrisk-level-filter", "highrisk-year-filter", "highrisk-month-filter", "highrisk-sort"].forEach((id) => {
    byId(id)?.addEventListener(id === "highrisk-search" ? "input" : "change", renderHighRisk);
  });

  async function loadHighRisk() {
    await ensureAreasLoaded();
    highRiskRows = await api("/analytics/high-risk?all=1");
    populateYearFilter("highrisk-year-filter", highRiskRows.map((row) => row.year));
    renderHighRisk();
  }

  function populateYearFilter(id, years) {
    const select = byId(id);
    if (!select) return;
    const old = select.value;
    const unique = [...new Set(years.map(Number).filter(Boolean))].sort((a, b) => b - a);
    select.innerHTML = `<option value="">All years</option>` + unique.map((year) => `<option value="${year}">${year}</option>`).join("");
    if (unique.map(String).includes(old)) select.value = old;
  }

  function renderHighRisk() {
    const search = safeLower(byId("highrisk-search")?.value).trim();
    const level = byId("highrisk-level-filter")?.value || "";
    const year = byId("highrisk-year-filter")?.value || "";
    const month = byId("highrisk-month-filter")?.value || "";
    const sort = byId("highrisk-sort")?.value || "period:desc";
    const riskWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };

    let rows = highRiskRows.filter((row) => {
      const matchesSearch = !search || [row.area_name, row.division, row.flagged_reason].some((value) => safeLower(value).includes(search));
      return matchesSearch && (!level || row.risk_level === level) && (!year || Number(row.year) === Number(year)) && (!month || Number(row.month) === Number(month));
    });
    rows = sortWithSpec(rows, sort, {
      "period:desc": (a, b) => (num(b.year) * 12 + num(b.month)) - (num(a.year) * 12 + num(a.month)),
      "risk:desc": (a, b) => (riskWeight[b.risk_level] || 0) - (riskWeight[a.risk_level] || 0),
    });

    byId("highrisk-table").innerHTML = `
      <thead><tr><th>ID</th><th>District</th><th>Division</th><th>Period</th><th>Risk Level</th><th>Reason</th><th>Flagged Date</th><th>Actions</th></tr></thead>
      <tbody>${rows.length ? rows.map((row) => `
        <tr>
          <td class="mono">#${row.zone_id}</td>
          <td><strong>${escapeHtml(row.area_name)}</strong></td>
          <td>${escapeHtml(row.division)}</td>
          <td>${row.month}/${row.year}</td>
          <td><span class="pill pill-${safeLower(row.risk_level)}">${escapeHtml(row.risk_level)}</span></td>
          <td>${escapeHtml(row.flagged_reason || "-")}</td>
          <td class="mono">${escapeHtml(row.flagged_date)}</td>
          <td><div class="row-actions">
            <button class="btn-sm" onclick="editHighRisk(${row.zone_id})">Edit</button>
            <button class="btn-sm danger" onclick="deleteHighRisk(${row.zone_id})">Delete</button>
          </div></td>
        </tr>
      `).join("") : `<tr><td colspan="8" class="empty-state">No high-risk records match the filters.</td></tr>`}</tbody>`;
  }

  function openHighRiskEditor(row = null) {
    byId("highrisk-form").reset();
    byId("highrisk-id").value = row?.zone_id || "";
    byId("highrisk-area").value = row?.area_id || "";
    byId("highrisk-month").value = row?.month || currentMonth;
    byId("highrisk-year").value = row?.year || currentYear;
    byId("highrisk-level").value = row?.risk_level || "High";
    byId("highrisk-date").value = row?.flagged_date || todayStr;
    byId("highrisk-reason").value = row?.flagged_reason || "";
    byId("highrisk-modal-title").textContent = row ? "Edit High Risk Zone" : "Flag High Risk Zone";
    showFormError("highrisk-form-error");
    openModal("highrisk-modal");
  }
  byId("add-highrisk-btn")?.addEventListener("click", () => openHighRiskEditor());
  byId("highrisk-cancel-btn")?.addEventListener("click", () => closeModal("highrisk-modal"));
  byId("highrisk-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = byId("highrisk-id").value;
    const payload = {
      area_id: Number(byId("highrisk-area").value),
      month: Number(byId("highrisk-month").value),
      year: Number(byId("highrisk-year").value),
      risk_level: byId("highrisk-level").value,
      flagged_date: byId("highrisk-date").value,
      flagged_reason: byId("highrisk-reason").value.trim(),
    };
    try {
      await api(id ? `/analytics/high-risk/${id}` : "/analytics/high-risk", { method: id ? "PUT" : "POST", body: payload });
      closeModal("highrisk-modal");
      await loadHighRisk();
      showToast(id ? "Risk flag updated." : "Risk flag added.", "success");
    } catch (error) {
      showFormError("highrisk-form-error", error.message);
    }
  });
  window.editHighRisk = (id) => openHighRiskEditor(highRiskRows.find((row) => Number(row.zone_id) === Number(id)));
  window.deleteHighRisk = async (id) => {
    if (!window.confirm("Delete this high-risk flag?")) return;
    try {
      await api(`/analytics/high-risk/${id}`, { method: "DELETE" });
      await loadHighRisk();
      showToast("Risk flag deleted.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // -------------------------------------------------------------------------
  // Monthly analysis
  // -------------------------------------------------------------------------
  ["analysis-area-filter", "analysis-year-filter", "analysis-month-filter", "analysis-sort"].forEach((id) => {
    byId(id)?.addEventListener("change", renderAnalysis);
  });

  async function loadAnalysis() {
    await ensureAreasLoaded();
    analysisRows = await api("/analytics/monthly");
    populateYearFilter("analysis-year-filter", analysisRows.map((row) => row.year));
    renderAnalysis();
  }

  function renderAnalysis() {
    const areaId = byId("analysis-area-filter")?.value || "";
    const year = byId("analysis-year-filter")?.value || "";
    const month = byId("analysis-month-filter")?.value || "";
    const sort = byId("analysis-sort")?.value || "period:desc";

    let rows = analysisRows.filter((row) =>
      (!areaId || Number(row.area_id) === Number(areaId)) &&
      (!year || Number(row.year) === Number(year)) &&
      (!month || Number(row.month) === Number(month))
    );
    rows = sortWithSpec(rows, sort, {
      "period:desc": (a, b) => (num(b.year) * 12 + num(b.month)) - (num(a.year) * 12 + num(a.month)),
    });

    byId("analysis-table").innerHTML = `
      <thead><tr><th>ID</th><th>District</th><th>Month/Year</th><th>Outage %</th><th>Avg Daily Hours</th><th>Total Outages</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${rows.length ? rows.map((row) => `
        <tr>
          <td class="mono">#${row.analysis_id}</td>
          <td><strong>${escapeHtml(row.area_name)}</strong><br><small>${escapeHtml(row.division || "")}</small></td>
          <td>${row.month}/${row.year}</td>
          <td class="mono">${num(row.outage_percentage).toFixed(2)}%</td>
          <td class="mono">${num(row.avg_daily_hours).toFixed(2)} hrs</td>
          <td>${row.total_outages}</td>
          <td><span class="pill pill-${row.improvement_status}">${escapeHtml(row.improvement_status)}</span></td>
          <td><div class="row-actions">
            <button class="btn-sm" onclick="editAnalysis(${row.analysis_id})">Edit</button>
            <button class="btn-sm danger" onclick="deleteAnalysis(${row.analysis_id})">Delete</button>
          </div></td>
        </tr>
      `).join("") : `<tr><td colspan="8" class="empty-state">No monthly analysis records match the filters.</td></tr>`}</tbody>`;

    const canvas = byId("chart-analysis");
    if (!canvas || typeof Chart === "undefined") return;
    chartAnalysis?.destroy();
    if (!rows.length) return;
    chartAnalysis = new Chart(canvas, {
      type: "bar",
      data: {
        labels: rows.map((row) => `${row.area_name} ${row.month}/${row.year}`),
        datasets: [
          { label: "Outage percentage", data: rows.map((row) => num(row.outage_percentage)), backgroundColor: "rgba(242,169,59,.8)", borderRadius: 6 },
          { label: "Average daily hours", data: rows.map((row) => num(row.avg_daily_hours)), backgroundColor: "rgba(75,159,225,.8)", borderRadius: 6 },
        ],
      },
      options: chartOptions(true),
    });
  }

  function openAnalysisEditor(row = null) {
    byId("analysis-form").reset();
    byId("analysis-id").value = row?.analysis_id || "";
    byId("analysis-area").value = row?.area_id || "";
    byId("analysis-month").value = row?.month || currentMonth;
    byId("analysis-year").value = row?.year || currentYear;
    byId("analysis-outage-pct").value = row?.outage_percentage ?? "";
    byId("analysis-avg-hours").value = row?.avg_daily_hours ?? "";
    byId("analysis-total-outages").value = row?.total_outages ?? "";
    byId("analysis-status").value = row?.improvement_status || "stable";
    byId("analysis-modal-title").textContent = row ? "Edit Monthly Analysis" : "Add Monthly Analysis";
    showFormError("analysis-form-error");
    openModal("analysis-modal");
  }
  byId("add-analysis-btn")?.addEventListener("click", () => openAnalysisEditor());
  byId("analysis-cancel-btn")?.addEventListener("click", () => closeModal("analysis-modal"));
  byId("analysis-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = byId("analysis-id").value;
    const payload = {
      area_id: Number(byId("analysis-area").value),
      month: Number(byId("analysis-month").value),
      year: Number(byId("analysis-year").value),
      outage_percentage: Number(byId("analysis-outage-pct").value),
      avg_daily_hours: Number(byId("analysis-avg-hours").value),
      total_outages: Number(byId("analysis-total-outages").value),
      improvement_status: byId("analysis-status").value,
    };
    try {
      await api(id ? `/analytics/monthly/${id}` : "/analytics/monthly", { method: id ? "PUT" : "POST", body: payload });
      closeModal("analysis-modal");
      await loadAnalysis();
      showToast(id ? "Monthly analysis updated." : "Monthly analysis added.", "success");
    } catch (error) {
      showFormError("analysis-form-error", error.message);
    }
  });
  window.editAnalysis = (id) => openAnalysisEditor(analysisRows.find((row) => Number(row.analysis_id) === Number(id)));
  window.deleteAnalysis = async (id) => {
    if (!window.confirm("Delete this monthly analysis record?")) return;
    try {
      await api(`/analytics/monthly/${id}`, { method: "DELETE" });
      await loadAnalysis();
      showToast("Monthly analysis deleted.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // -------------------------------------------------------------------------
  // Authority actions
  // -------------------------------------------------------------------------
  ["action-search", "action-area-filter", "action-type-filter", "action-sort"].forEach((id) => {
    byId(id)?.addEventListener(id === "action-search" ? "input" : "change", renderActions);
  });

  async function loadActions() {
    await ensureAreasLoaded();
    actionRows = await api("/actions");
    renderActions();
  }

  function renderActions() {
    const search = safeLower(byId("action-search")?.value).trim();
    const areaId = byId("action-area-filter")?.value || "";
    const type = byId("action-type-filter")?.value || "";
    const sort = byId("action-sort")?.value || "action_time:desc";

    let rows = actionRows.filter((row) => {
      const matchesSearch = !search || [row.action_type, row.notes, row.area_name, row.user_name, row.citizen_name].some((value) => safeLower(value).includes(search));
      return matchesSearch && (!areaId || Number(row.area_id) === Number(areaId)) && (!type || row.action_type === type);
    });
    rows = sortWithSpec(rows, sort);

    byId("action-timeline-feed").innerHTML = rows.length ? rows.map((row) => `
      <div class="timeline-card">
        <div class="timeline-icon-box type-default">⚡</div>
        <div class="timeline-content">
          <div class="timeline-top"><span class="timeline-type-name">${escapeHtml(row.action_type)}</span><span class="timeline-area-tag">${escapeHtml(row.area_name)}</span></div>
          <div class="timeline-officer-row">By <span class="officer-chip">${escapeHtml(row.user_name)}</span> at ${escapeHtml(formatDateTime(row.action_time))}</div>
          <div class="timeline-notes">${escapeHtml(row.notes || "-")}</div>
          ${row.complaint_id ? `<div class="text-muted" style="font-size:12px;margin-top:6px;">Complaint #${row.complaint_id}</div>` : ""}
          <div class="row-actions" style="margin-top:10px;">
            <button class="btn-sm" onclick="editAction(${row.action_id})">Edit</button>
            <button class="btn-sm danger" onclick="deleteAction(${row.action_id})">Delete</button>
          </div>
        </div>
      </div>
    `).join("") : `<div class="empty-state">No authority actions match the filters.</div>`;
  }

  function resetActionForm() {
    byId("action-form").reset();
    byId("action-id").value = "";
    byId("action-submit-btn").textContent = "⚡ Log & Dispatch Action";
    byId("action-cancel-edit-btn").style.display = "none";
  }
  byId("action-cancel-edit-btn")?.addEventListener("click", resetActionForm);
  byId("action-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = byId("action-id").value;
    const payload = {
      area_id: Number(byId("action-area").value),
      action_type: byId("action-type").value,
      notes: byId("action-notes").value.trim(),
    };
    try {
      await api(id ? `/actions/${id}` : "/actions", { method: id ? "PUT" : "POST", body: payload });
      resetActionForm();
      await loadActions();
      showToast(id ? "Authority action updated." : "Authority action logged.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });
  window.editAction = (id) => {
    const row = actionRows.find((item) => Number(item.action_id) === Number(id));
    if (!row) return;
    byId("action-id").value = row.action_id;
    byId("action-area").value = row.area_id;
    byId("action-type").value = row.action_type;
    byId("action-notes").value = row.notes || "";
    byId("action-submit-btn").textContent = "Save Action Changes";
    byId("action-cancel-edit-btn").style.display = "inline-flex";
    byId("action-form").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  window.deleteAction = async (id) => {
    if (!window.confirm("Delete this authority action log?")) return;
    try {
      await api(`/actions/${id}`, { method: "DELETE" });
      await loadActions();
      showToast("Authority action deleted.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // -------------------------------------------------------------------------
  // Authority users and M:N area assignments
  // -------------------------------------------------------------------------
  ["user-search", "user-role-filter", "user-sort"].forEach((id) => {
    byId(id)?.addEventListener(id === "user-search" ? "input" : "change", renderUsers);
  });

  async function loadUsers() {
    await ensureAreasLoaded();
    userRows = await api("/users");
    renderUsers();
  }

  function assignedCount(user) {
    return Array.isArray(user.assigned_areas) ? user.assigned_areas.length : 0;
  }

  function renderUsers() {
    const search = safeLower(byId("user-search")?.value).trim();
    const role = byId("user-role-filter")?.value || "";
    const sort = byId("user-sort")?.value || "user_name:asc";

    let rows = userRows
      .filter((row) => (!search || [row.user_name, row.contact_email].some((value) => safeLower(value).includes(search))) && (!role || row.role === role))
      .map((row) => ({ ...row, assigned: assignedCount(row) }));
    rows = sortWithSpec(rows, sort);

    byId("users-table-body").innerHTML = rows.length ? rows.map((row) => `
      <tr>
        <td class="mono">#${row.user_id}</td>
        <td><strong>${escapeHtml(row.user_name)}</strong></td>
        <td><span class="pill pill-${row.role === "admin" ? "open" : "stable"}">${escapeHtml(row.role)}</span></td>
        <td>${escapeHtml(row.contact_email || "-")}</td>
        <td><span class="pill pill-in_review">${row.assigned} districts assigned</span></td>
        <td><div class="row-actions" style="flex-wrap:wrap;">
          <button class="btn-sm" onclick="manageUserAreas(${row.user_id})">Manage Areas</button>
          ${isAdmin ? `<button class="btn-sm" onclick="editUser(${row.user_id})">Edit</button>` : ""}
          ${isAdmin && Number(row.user_id) !== Number(currentUser.user_id) ? `<button class="btn-sm danger" onclick="deleteUser(${row.user_id})">Delete</button>` : ""}
        </div></td>
      </tr>
    `).join("") : `<tr><td colspan="6" class="empty-state">No users match the filters.</td></tr>`;
  }

  function openUserEditor(row = null) {
    byId("user-form").reset();
    byId("user-id-input").value = row?.user_id || "";
    byId("user-username-input").value = row?.user_name || "";
    byId("user-email-input").value = row?.contact_email || "";
    byId("user-role-input").value = row?.role || "officer";
    byId("user-password-input").required = !row;
    byId("user-password-hint").textContent = row ? "(leave blank to keep current password)" : "(required for new user)";
    byId("user-modal-title").textContent = row ? "Edit Staff Account" : "Create Staff Account";
    showFormError("user-form-error");
    openModal("user-modal");
  }

  byId("add-user-btn")?.addEventListener("click", () => {
    if (!isAdmin) return showToast("Only an administrator can create staff accounts.", "error");
    openUserEditor();
  });
  byId("user-cancel-btn")?.addEventListener("click", () => closeModal("user-modal"));
  byId("user-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = byId("user-id-input").value;
    const payload = {
      user_name: byId("user-username-input").value.trim(),
      contact_email: byId("user-email-input").value.trim(),
      role: byId("user-role-input").value,
    };
    const password = byId("user-password-input").value;
    if (password) payload.password = password;

    try {
      await api(id ? `/users/${id}` : "/users", { method: id ? "PUT" : "POST", body: payload });
      closeModal("user-modal");
      await loadUsers();
      showToast(id ? "User updated." : "User account created.", "success");
    } catch (error) {
      showFormError("user-form-error", error.message);
    }
  });
  window.editUser = (id) => openUserEditor(userRows.find((row) => Number(row.user_id) === Number(id)));
  window.deleteUser = async (id) => {
    if (!window.confirm("Delete this authority user? Their area assignments and action records may be affected by foreign-key rules.")) return;
    try {
      await api(`/users/${id}`, { method: "DELETE" });
      await loadUsers();
      showToast("User deleted.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  let selectedUserId = null;
  let selectedAreaIds = [];
  let assignmentDivision = "";

  function normalizeAreaIds(value) {
    const rows = Array.isArray(value) ? value : value?.assigned_areas || [];
    return rows.map((item) => Number(typeof item === "object" ? item.area_id : item)).filter(Number.isFinite);
  }

  window.manageUserAreas = async (userId) => {
    selectedUserId = Number(userId);
    const user = userRows.find((row) => Number(row.user_id) === selectedUserId);
    byId("user-areas-modal-title").textContent = `Manage Area Assignments — ${user?.user_name || `User #${userId}`}`;
    byId("user-area-search").value = "";
    assignmentDivision = "";
    try {
      selectedAreaIds = normalizeAreaIds(await api(`/users/${userId}/areas`));
      renderAssignmentDivisionPills();
      renderUserAreaGrid();
      openModal("user-areas-modal");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  function renderAssignmentDivisionPills() {
    const divisions = [...new Set(allAreas.map((area) => area.division))].sort();
    byId("user-area-division-pills").innerHTML = ["", ...divisions].map((division) => `
      <button type="button" class="btn-pill-action ${assignmentDivision === division ? "active" : ""}" onclick="setAssignmentDivision('${String(division).replace(/'/g, "\\'")}')">${division || "All"}</button>
    `).join("");
  }

  function visibleAssignmentAreas() {
    const search = safeLower(byId("user-area-search")?.value).trim();
    return allAreas.filter((area) =>
      (!assignmentDivision || area.division === assignmentDivision) &&
      (!search || [area.area_name, area.division, area.region_type].some((value) => safeLower(value).includes(search)))
    );
  }

  function renderUserAreaGrid() {
    const visible = visibleAssignmentAreas();
    byId("user-areas-checkboxes").innerHTML = visible.length ? visible.map((area) => {
      const selected = selectedAreaIds.includes(Number(area.area_id));
      return `
        <div class="district-card ${selected ? "selected" : ""}" onclick="toggleAreaSelection(${area.area_id})">
          <div class="district-card-info"><span class="district-card-name">${escapeHtml(area.area_name)}</span><span class="district-card-div">${escapeHtml(area.division)} · ${escapeHtml(area.region_type)}</span></div>
          <div class="district-card-check"><svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5"/></svg></div>
        </div>`;
    }).join("") : `<div class="empty-state">No districts match this assignment filter.</div>`;
    updateAssignmentProgress();
  }

  function updateAssignmentProgress() {
    const total = allAreas.length || 1;
    const count = selectedAreaIds.length;
    const percentage = Math.round((count / total) * 100);
    byId("assignment-progress-text").textContent = `${count} / ${total} Districts (${percentage}%)`;
    byId("assignment-progress-bar").style.width = `${percentage}%`;
  }

  window.toggleAreaSelection = (areaId) => {
    const id = Number(areaId);
    selectedAreaIds = selectedAreaIds.includes(id) ? selectedAreaIds.filter((value) => value !== id) : [...selectedAreaIds, id];
    renderUserAreaGrid();
  };
  window.setAssignmentDivision = (division) => {
    assignmentDivision = division;
    renderAssignmentDivisionPills();
    renderUserAreaGrid();
  };
  window.selectAllAreas = (selected) => {
    selectedAreaIds = selected ? allAreas.map((area) => Number(area.area_id)) : [];
    renderUserAreaGrid();
  };
  window.selectFilteredDivisionAreas = () => {
    const visibleIds = visibleAssignmentAreas().map((area) => Number(area.area_id));
    selectedAreaIds = [...new Set([...selectedAreaIds, ...visibleIds])];
    renderUserAreaGrid();
  };

  byId("user-area-search")?.addEventListener("input", renderUserAreaGrid);
  byId("user-areas-cancel-btn")?.addEventListener("click", () => closeModal("user-areas-modal"));
  byId("user-areas-close-x")?.addEventListener("click", () => closeModal("user-areas-modal"));
  byId("user-areas-save-btn")?.addEventListener("click", async () => {
    if (!selectedUserId) return;
    if (!isAdmin) return showToast("Only an administrator can change area assignments.", "error");
    try {
      await api(`/users/${selectedUserId}/areas`, { method: "PUT", body: { area_ids: selectedAreaIds } });
      closeModal("user-areas-modal");
      await loadUsers();
      showToast("Area assignments saved.", "success");
    } catch (error) {
      showFormError("user-areas-form-error", error.message);
    }
  });

  // Hide admin-only create control for officers, but keep user list readable.
  if (!isAdmin) {
    byId("add-user-btn").style.display = "none";
  }

  // Initial page load.
  switchSection(location.hash ? location.hash.slice(1) : "overview");
});