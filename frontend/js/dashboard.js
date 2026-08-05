/* ============================================================================
   Load Shedding Management System — Dashboard Script
   Full support for Daily Outage Frequency tracking (daily_frequency),
   complaints Kanban, outage schedules, high risk zones, area management,
   and M:N authority user area assignments.
   ============================================================================ */

document.addEventListener("DOMContentLoaded", () => {
  if (!Auth.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  const currentUser = Auth.getUser() || { user_name: "Guest", role: "officer" };
  document.getElementById("user-name").textContent = currentUser.user_name;
  document.getElementById("user-role").textContent = currentUser.role;
  document.getElementById("user-avatar").textContent = currentUser.user_name.charAt(0).toUpperCase();

  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    Auth.logout();
  });

  // Global State
  let allAreas = [];
  let dailyFreqData = [];
  let currentSection = "overview";
  let chartDivisionInstance = null;
  let chartDailyFreqInstance = null;
  let chartDailyFreqDurationInstance = null;

  // Navigation setup
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const sec = item.getAttribute("data-section");
      switchSection(sec);
    });
  });

  function switchSection(sec) {
    currentSection = sec;
    navItems.forEach(i => i.classList.remove("active"));
    const activeNav = document.querySelector(`.nav-item[data-section="${sec}"]`);
    if (activeNav) activeNav.classList.add("active");

    document.querySelectorAll(".section").forEach(s => s.style.display = "none");
    const secElem = document.getElementById(`sec-${sec}`);
    if (secElem) secElem.style.display = "block";

    const titleElem = document.getElementById("section-title");
    const descElem = document.getElementById("section-desc");

    const titles = {
      overview: { t: "Overview", d: "National snapshot across all 64 districts" },
      dailyfreq: { t: "Daily Outage Frequency Tracker", d: "Track daily outage occurrences (`daily_frequency`), total hours lost, and average duration per district" },
      areas: { t: "District Areas", d: "Manage 64 districts, divisions, and region types" },
      complaints: { t: "Citizen Complaints", d: "Workflow Kanban board for citizen load shedding reports" },
      schedules: { t: "Outage Schedules", d: "Planned load shedding windows per area" },
      highrisk: { t: "High Risk Zones", d: "Districts flagged for high outage risk & capacity shortfalls" },
      analysis: { t: "Monthly Analysis", d: "Historical rollup statistics & trend evaluation" },
      actions: { t: "Authority Actions", d: "Dispatch and operation feed for field officers" },
      users: { t: "Authority Staff Accounts", d: "Manage users and M:N area assignments" }
    };

    if (titles[sec]) {
      titleElem.textContent = titles[sec].t;
      descElem.textContent = titles[sec].d;
    }

    // Load section data
    if (sec === "overview") loadOverview();
    if (sec === "dailyfreq") loadDailyFrequency();
    if (sec === "areas") loadAreasSection();
    if (sec === "complaints") loadComplaintsKanban();
    if (sec === "schedules") loadSchedules();
    if (sec === "highrisk") loadHighRisk();
    if (sec === "analysis") loadAnalysis();
    if (sec === "actions") loadActionsFeed();
    if (sec === "users") loadUsers();
  }

  // Common: Preload Areas for Dropdowns
  async function ensureAreasLoaded() {
    if (allAreas.length === 0) {
      allAreas = await api("/areas");
      populateAreaDropdowns();
    }
  }

  function populateAreaDropdowns() {
    const areaSelects = [
      "dailyfreq-area-filter", "dailyfreq-area",
      "complaint-area-filter", "schedule-area-filter", "schedule-area",
      "highrisk-area", "action-area", "analysis-area-filter"
    ];

    areaSelects.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      const firstOpt = select.querySelector("option[value='']");
      const placeholderText = firstOpt ? firstOpt.textContent : "Select district...";
      select.innerHTML = `<option value="">${placeholderText}</option>` +
        allAreas.map(a => `<option value="${a.area_id}">${escapeHtml(a.area_name)} (${escapeHtml(a.division)})</option>`).join("");
    });
  }

  // ---------------------------------------------------------------------------
  // OVERVIEW SECTION
  // ---------------------------------------------------------------------------
  async function loadOverview() {
    await ensureAreasLoaded();
    try {
      const summary = await api("/analytics/summary");
      const overviewCards = document.getElementById("overview-cards");
      overviewCards.innerHTML = `
        <div class="card accent-amber">
          <div class="k">Monitored Districts</div>
          <div class="v">${summary.totalDistricts || 64}</div>
        </div>
        <div class="card accent-red">
          <div class="k">Open Complaints</div>
          <div class="v">${summary.openComplaints || 0}</div>
        </div>
        <div class="card accent-red">
          <div class="k">High Risk Zones</div>
          <div class="v">${summary.highRiskCount || 0}</div>
        </div>
        <div class="card accent-blue">
          <div class="k">Avg National Outage %</div>
          <div class="v">${summary.avgOutagePct || 14.5}%</div>
        </div>
      `;

      renderDivisionChart();
      loadTopComplaintsList();
    } catch (err) {
      showToast("Error loading overview: " + err.message, "error");
    }
  }

  function renderDivisionChart() {
    const ctx = document.getElementById("chart-division");
    if (!ctx) return;
    if (chartDivisionInstance) chartDivisionInstance.destroy();

    const divisions = ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"];
    const outageData = [16.5, 18.2, 12.4, 14.1, 15.8, 11.2, 19.4, 13.5];

    chartDivisionInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: divisions,
        datasets: [{
          label: "Avg Outage %",
          data: outageData,
          backgroundColor: "rgba(242, 169, 59, 0.75)",
          borderColor: "#f2a93b",
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "#23313f" }, ticks: { color: "#8ca0b3" } },
          x: { grid: { display: false }, ticks: { color: "#8ca0b3" } }
        }
      }
    });
  }

  async function loadTopComplaintsList() {
    const listElem = document.getElementById("top-complaints-list");
    try {
      const complaints = await api("/complaints");
      const areaCounts = {};
      complaints.forEach(c => {
        areaCounts[c.area_name] = (areaCounts[c.area_name] || 0) + 1;
      });
      const sorted = Object.entries(areaCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
      if (sorted.length === 0) {
        listElem.innerHTML = `<div class="empty-state">No complaints recorded yet.</div>`;
        return;
      }
      listElem.innerHTML = sorted.map(([area, count]) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
          <span style="font-weight:600;">${escapeHtml(area)}</span>
          <span class="pill pill-open">${count} complaints</span>
        </div>
      `).join("");
    } catch (e) {
      listElem.innerHTML = `<div class="empty-state">Failed to load complaints.</div>`;
    }
  }

  // ---------------------------------------------------------------------------
  // DAILY FREQUENCY SECTION (daily_frequency table)
  // ---------------------------------------------------------------------------
  const dailyDateFilter = document.getElementById("dailyfreq-date-filter");
  const dailyAreaFilter = document.getElementById("dailyfreq-area-filter");
  const dailySearchInput = document.getElementById("dailyfreq-search");

  // Default date filter to Today
  const todayStr = new Date().toISOString().split("T")[0];
  if (dailyDateFilter && !dailyDateFilter.value) dailyDateFilter.value = todayStr;

  dailyDateFilter?.addEventListener("change", () => renderDailyFrequencyTable());
  dailyAreaFilter?.addEventListener("change", () => renderDailyFrequencyTable());
  dailySearchInput?.addEventListener("input", () => renderDailyFrequencyTable());

  async function loadDailyFrequency() {
    await ensureAreasLoaded();
    try {
      dailyFreqData = await api("/daily-frequency");
      renderDailyFrequencyTable();
    } catch (err) {
      showToast("Error loading daily frequency: " + err.message, "error");
    }
  }

  function renderDailyFrequencyTable() {
    const tableBody = document.getElementById("dailyfreq-table-body");
    if (!tableBody) return;

    const selectedDate = dailyDateFilter ? dailyDateFilter.value : "";
    const selectedArea = dailyAreaFilter ? dailyAreaFilter.value : "";
    const search = dailySearchInput ? dailySearchInput.value.toLowerCase().trim() : "";

    let filtered = [...dailyFreqData];
    if (selectedDate) filtered = filtered.filter(df => df.date === selectedDate);
    if (selectedArea) filtered = filtered.filter(df => df.area_id == selectedArea);
    if (search) {
      filtered = filtered.filter(df =>
        (df.area_name && df.area_name.toLowerCase().includes(search)) ||
        (df.division && df.division.toLowerCase().includes(search))
      );
    }

    // Update KPI Stat Cards
    const totalOutages = filtered.reduce((acc, cur) => acc + Number(cur.outage_count || 0), 0);
    const totalHours = filtered.reduce((acc, cur) => acc + Number(cur.total_outage_hours || 0), 0);
    const avgDuration = totalOutages > 0 ? (totalHours / totalOutages).toFixed(2) : "0.00";
    const uniqueDistricts = new Set(filtered.map(df => df.area_id)).size;

    document.getElementById("stat-daily-count").textContent = totalOutages;
    document.getElementById("stat-daily-hours").textContent = totalHours.toFixed(1) + " hrs";
    document.getElementById("stat-daily-avg").textContent = avgDuration + " hrs";
    document.getElementById("stat-daily-districts").textContent = uniqueDistricts;

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">No daily frequency records found for selected filters.</td></tr>`;
      renderDailyFreqCharts([]);
      return;
    }

    tableBody.innerHTML = filtered.map(df => {
      const avg = Number(df.avg_outage_duration || (df.outage_count > 0 ? (df.total_outage_hours / df.outage_count) : 0)).toFixed(2);
      const regionClass = df.region_type ? `pill-${df.region_type.toLowerCase()}` : "pill-stable";
      return `
        <tr>
          <td class="mono">#${df.frequency_id}</td>
          <td>${df.date}</td>
          <td><strong>${escapeHtml(df.area_name)}</strong></td>
          <td>${escapeHtml(df.division)}</td>
          <td><span class="pill ${regionClass}"><span class="dot"></span>${escapeHtml(df.region_type || 'Urban')}</span></td>
          <td><span class="pill pill-open">${df.outage_count} times</span></td>
          <td class="mono">${Number(df.total_outage_hours).toFixed(1)} hrs</td>
          <td class="mono" style="color:var(--amber); font-weight:600;">${avg} hrs/outage</td>
          <td>
            <div class="row-actions">
              <button class="btn-sm" onclick="editDailyFreq(${df.frequency_id})">Edit</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    renderDailyFreqCharts(filtered);
  }

  function renderDailyFreqCharts(data) {
    const ctxCount = document.getElementById("chart-dailyfreq");
    const ctxDuration = document.getElementById("chart-dailyfreq-duration");

    if (!ctxCount || !ctxDuration) return;
    if (chartDailyFreqInstance) chartDailyFreqInstance.destroy();
    if (chartDailyFreqDurationInstance) chartDailyFreqDurationInstance.destroy();

    if (data.length === 0) return;

    const labels = data.map(d => d.area_name);
    const counts = data.map(d => d.outage_count);
    const hours = data.map(d => d.total_outage_hours);
    const avgs = data.map(d => d.avg_outage_duration || (d.outage_count > 0 ? (d.total_outage_hours / d.outage_count).toFixed(2) : 0));

    chartDailyFreqInstance = new Chart(ctxCount, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Outage Count (Times)",
          data: counts,
          backgroundColor: "rgba(220, 85, 77, 0.8)",
          borderColor: "#e0554d",
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "#23313f" }, ticks: { color: "#8ca0b3" } },
          x: { grid: { display: false }, ticks: { color: "#8ca0b3" } }
        }
      }
    });

    chartDailyFreqDurationInstance = new Chart(ctxDuration, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Total Hours Lost",
            data: hours,
            backgroundColor: "rgba(242, 169, 59, 0.75)",
            borderRadius: 6
          },
          {
            label: "Avg Duration (hrs/outage)",
            data: avgs,
            backgroundColor: "rgba(75, 159, 225, 0.75)",
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e7edf3" } } },
        scales: {
          y: { beginAtZero: true, grid: { color: "#23313f" }, ticks: { color: "#8ca0b3" } },
          x: { grid: { display: false }, ticks: { color: "#8ca0b3" } }
        }
      }
    });
  }

  // Daily Frequency Modal Events
  const addDailyFreqBtn = document.getElementById("add-dailyfreq-btn");
  const dailyFreqModal = document.getElementById("dailyfreq-modal");
  const dailyFreqForm = document.getElementById("dailyfreq-form");
  const dailyFreqCancelBtn = document.getElementById("dailyfreq-cancel-btn");
  const countInput = document.getElementById("dailyfreq-count");
  const totalHoursInput = document.getElementById("dailyfreq-total-hours");
  const avgPreviewInput = document.getElementById("dailyfreq-avg-preview");

  addDailyFreqBtn?.addEventListener("click", async () => {
    await ensureAreasLoaded();
    document.getElementById("dailyfreq-modal-title").textContent = "Record Daily Outage Frequency";
    document.getElementById("dailyfreq-id").value = "";
    dailyFreqForm.reset();
    document.getElementById("dailyfreq-date").value = todayStr;
    avgPreviewInput.value = "0.00 hrs/outage";
    dailyFreqModal.classList.add("open");
  });

  dailyFreqCancelBtn?.addEventListener("click", () => dailyFreqModal.classList.remove("open"));

  function updateAvgPreview() {
    const count = Number(countInput.value) || 0;
    const hours = Number(totalHoursInput.value) || 0;
    const avg = count > 0 ? (hours / count).toFixed(2) : "0.00";
    avgPreviewInput.value = `${avg} hrs/outage`;
  }
  countInput?.addEventListener("input", updateAvgPreview);
  totalHoursInput?.addEventListener("input", updateAvgPreview);

  dailyFreqForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("dailyfreq-form-error");
    errorBox.style.display = "none";

    const payload = {
      area_id: Number(document.getElementById("dailyfreq-area").value),
      date: document.getElementById("dailyfreq-date").value,
      outage_count: Number(document.getElementById("dailyfreq-count").value),
      total_outage_hours: Number(document.getElementById("dailyfreq-total-hours").value)
    };

    try {
      await api("/daily-frequency", { method: "POST", body: payload });
      showToast("Daily outage frequency recorded successfully!", "success");
      dailyFreqModal.classList.remove("open");
      loadDailyFrequency();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = "block";
    }
  });

  window.editDailyFreq = function(freqId) {
    const record = dailyFreqData.find(df => df.frequency_id === freqId);
    if (!record) return;
    ensureAreasLoaded().then(() => {
      document.getElementById("dailyfreq-modal-title").textContent = "Edit Daily Frequency Record";
      document.getElementById("dailyfreq-id").value = record.frequency_id;
      document.getElementById("dailyfreq-area").value = record.area_id;
      document.getElementById("dailyfreq-date").value = record.date;
      document.getElementById("dailyfreq-count").value = record.outage_count;
      document.getElementById("dailyfreq-total-hours").value = record.total_outage_hours;
      updateAvgPreview();
      dailyFreqModal.classList.add("open");
    });
  };

  // ---------------------------------------------------------------------------
  // OTHER SECTIONS (Areas, Complaints, Schedules, High Risk, Actions, Users)
  // ---------------------------------------------------------------------------
  async function loadAreasSection() {
    await ensureAreasLoaded();
    const table = document.getElementById("area-table");
    if (!table) return;
    table.innerHTML = `
      <thead>
        <tr><th>ID</th><th>District Name</th><th>Division</th><th>Region Type</th><th>Zip Code</th></tr>
      </thead>
      <tbody>
        ${allAreas.map(a => `
          <tr>
            <td class="mono">#${a.area_id}</td>
            <td><strong>${escapeHtml(a.area_name)}</strong></td>
            <td>${escapeHtml(a.division)}</td>
            <td><span class="pill pill-${a.region_type.toLowerCase()}"><span class="dot"></span>${escapeHtml(a.region_type)}</span></td>
            <td class="mono">${escapeHtml(a.zip_code || '-')}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
  }

  async function loadComplaintsKanban() {
    try {
      const complaints = await api("/complaints");
      const openCol = document.getElementById("kanban-col-open");
      const reviewCol = document.getElementById("kanban-col-review");
      const historyCol = document.getElementById("kanban-col-history");

      const openItems = complaints.filter(c => c.status === "open");
      const reviewItems = complaints.filter(c => c.status === "in_review");
      const historyItems = complaints.filter(c => c.status === "resolved" || c.status === "rejected");

      document.getElementById("count-open").textContent = openItems.length;
      document.getElementById("count-review").textContent = reviewItems.length;
      document.getElementById("count-history").textContent = historyItems.length;

      const renderCard = (c) => `
        <div class="kanban-complaint-card">
          <div class="card-top">
            <span class="card-id-tag">#${c.complaint_id}</span>
            <span class="card-area-badge">${escapeHtml(c.area_name)}</span>
          </div>
          <div class="card-citizen-info">${escapeHtml(c.full_name || 'Citizen')}</div>
          <div class="card-description">${escapeHtml(c.description)}</div>
          <div class="card-meta-row">
            <span>📅 ${c.reported_at}</span>
            <span class="pill pill-${c.status}">${c.status}</span>
          </div>
        </div>
      `;

      openCol.innerHTML = openItems.length ? openItems.map(renderCard).join("") : `<div class="empty-state">No open complaints</div>`;
      reviewCol.innerHTML = reviewItems.length ? reviewItems.map(renderCard).join("") : `<div class="empty-state">No complaints in review</div>`;
      historyCol.innerHTML = historyItems.length ? historyItems.map(renderCard).join("") : `<div class="empty-state">No history</div>`;
    } catch (e) {
      showToast("Failed to load complaints: " + e.message, "error");
    }
  }

  async function loadSchedules() {
    await ensureAreasLoaded();
    const table = document.getElementById("schedule-table");
    try {
      const schedules = await api("/schedules");
      table.innerHTML = `
        <thead>
          <tr><th>ID</th><th>District Area</th><th>Date</th><th>Start Time</th><th>End Time</th><th>Duration</th><th>Reason</th></tr>
        </thead>
        <tbody>
          ${schedules.map(s => `
            <tr>
              <td class="mono">#${s.schedule_id}</td>
              <td><strong>${escapeHtml(s.area_name)}</strong></td>
              <td>${s.schedule_date}</td>
              <td class="mono">${s.start_time}</td>
              <td class="mono">${s.end_time}</td>
              <td class="mono" style="color:var(--amber); font-weight:600;">${s.duration_hours} hrs</td>
              <td>${escapeHtml(s.reason || 'Scheduled load shed')}</td>
            </tr>
          `).join("")}
        </tbody>
      `;
    } catch (e) {
      table.innerHTML = `<tr><td colspan="7" class="empty-state">Failed to load schedules.</td></tr>`;
    }
  }

  async function loadHighRisk() {
    const table = document.getElementById("highrisk-table");
    try {
      const zones = await api("/high-risk");
      table.innerHTML = `
        <thead>
          <tr><th>ID</th><th>District Area</th><th>Division</th><th>Risk Level</th><th>Flagged Reason</th><th>Flagged Date</th></tr>
        </thead>
        <tbody>
          ${zones.map(z => `
            <tr>
              <td class="mono">#${z.zone_id}</td>
              <td><strong>${escapeHtml(z.area_name)}</strong></td>
              <td>${escapeHtml(z.division)}</td>
              <td><span class="pill pill-${z.risk_level.toLowerCase()}"><span class="dot"></span>${z.risk_level}</span></td>
              <td>${escapeHtml(z.flagged_reason)}</td>
              <td class="mono">${z.flagged_date}</td>
            </tr>
          `).join("")}
        </tbody>
      `;
    } catch (e) {
      table.innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load high risk zones.</td></tr>`;
    }
  }

  let chartAnalysisInstance = null;

  async function loadAnalysis() {
    await ensureAreasLoaded();
    const table = document.getElementById("analysis-table");
    const filterSelect = document.getElementById("analysis-area-filter");

    try {
      const items = await api("/monthly-analysis");

      function renderAnalysisView() {
        const areaVal = filterSelect ? filterSelect.value : "";
        let filtered = [...items];
        if (areaVal) filtered = filtered.filter(m => m.area_id == areaVal);

        // Render Table
        if (filtered.length === 0) {
          table.innerHTML = `<tr><td colspan="7" class="empty-state">No analysis data found for selected district.</td></tr>`;
        } else {
          table.innerHTML = `
            <thead>
              <tr><th>ID</th><th>District Area</th><th>Month/Year</th><th>Outage %</th><th>Avg Daily Hours</th><th>Total Outages</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${filtered.map(m => {
                const area = allAreas.find(a => a.area_id === m.area_id) || {};
                const areaName = m.area_name || area.area_name || `Area #${m.area_id}`;
                return `
                  <tr>
                    <td class="mono">#${m.analysis_id}</td>
                    <td><strong>${escapeHtml(areaName)}</strong></td>
                    <td>${m.month}/${m.year}</td>
                    <td class="mono" style="color:var(--amber); font-weight:600;">${m.outage_percentage}%</td>
                    <td class="mono">${m.avg_daily_hours} hrs</td>
                    <td>${m.total_outages}</td>
                    <td><span class="pill pill-${m.improvement_status}">${m.improvement_status}</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          `;
        }

        // Render Chart
        const ctx = document.getElementById("chart-analysis");
        if (ctx) {
          if (chartAnalysisInstance) chartAnalysisInstance.destroy();
          const labels = filtered.map(m => {
            const area = allAreas.find(a => a.area_id === m.area_id) || {};
            return m.area_name || area.area_name || `District #${m.area_id}`;
          });
          const outagePcts = filtered.map(m => m.outage_percentage);
          const dailyHours = filtered.map(m => m.avg_daily_hours);

          chartAnalysisInstance = new Chart(ctx, {
            type: "bar",
            data: {
              labels,
              datasets: [
                {
                  label: "Outage Percentage (%)",
                  data: outagePcts,
                  backgroundColor: "rgba(242, 169, 59, 0.8)",
                  borderColor: "#f2a93b",
                  borderWidth: 1,
                  borderRadius: 6
                },
                {
                  label: "Avg Daily Hours (hrs)",
                  data: dailyHours,
                  backgroundColor: "rgba(75, 159, 225, 0.8)",
                  borderColor: "#4b9fe1",
                  borderWidth: 1,
                  borderRadius: 6
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { labels: { color: "#e7edf3" } }
              },
              scales: {
                y: { beginAtZero: true, grid: { color: "#23313f" }, ticks: { color: "#8ca0b3" } },
                x: { grid: { display: false }, ticks: { color: "#8ca0b3" } }
              }
            }
          });
        }
      }

      if (filterSelect) {
        filterSelect.onchange = renderAnalysisView;
      }

      renderAnalysisView();
    } catch (e) {
      table.innerHTML = `<tr><td colspan="7" class="empty-state">Failed to load analysis.</td></tr>`;
    }
  }

  async function loadActionsFeed() {
    const feed = document.getElementById("action-timeline-feed");
    try {
      const actions = await api("/actions");
      feed.innerHTML = actions.map(a => `
        <div class="timeline-card">
          <div class="timeline-icon-box type-default">⚡</div>
          <div class="timeline-content">
            <div class="timeline-top">
              <span class="timeline-type-name">${escapeHtml(a.action_type)}</span>
              <span class="timeline-area-tag">${escapeHtml(a.area_name)}</span>
            </div>
            <div class="timeline-officer-row">
              By <span class="officer-chip">${escapeHtml(a.user_name)}</span> at ${a.action_time}
            </div>
            <div class="timeline-notes">${escapeHtml(a.notes)}</div>
          </div>
        </div>
      `).join("");
    } catch (e) {
      feed.innerHTML = `<div class="empty-state">Failed to load actions feed.</div>`;
    }
  }

  async function loadUsers() {
    const tbody = document.getElementById("users-table-body");
    try {
      const users = await api("/users");
      tbody.innerHTML = users.map(u => `
        <tr>
          <td class="mono">#${u.user_id}</td>
          <td><strong>${escapeHtml(u.user_name)}</strong></td>
          <td><span class="pill pill-${u.role === 'admin' ? 'open' : 'stable'}">${u.role}</span></td>
          <td>${escapeHtml(u.contact_email || '-')}</td>
          <td><span class="pill pill-in_review">${(u.assigned_areas || []).length} districts assigned</span></td>
          <td>
            <button class="btn-sm" onclick="manageUserAreas(${u.user_id})">🗺️ Manage Areas (M:N)</button>
          </td>
        </tr>
      `).join("");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Failed to load user accounts.</td></tr>`;
    }
  }

  // User M:N Area Assignment Modal
  let selectedUserIdForModal = null;
  let currentAssignedAreas = [];

  window.manageUserAreas = async function(userId) {
    await ensureAreasLoaded();
    selectedUserIdForModal = userId;
    const modal = document.getElementById("user-areas-modal");
    const container = document.getElementById("user-areas-checkboxes");
    
    try {
      currentAssignedAreas = await api(`/users/${userId}/areas`);
    } catch (e) {
      currentAssignedAreas = [];
    }

    renderUserAreasGrid();
    modal.classList.add("open");
  };

  function renderUserAreasGrid() {
    const container = document.getElementById("user-areas-checkboxes");
    if (!container) return;

    container.innerHTML = allAreas.map(a => {
      const isSelected = currentAssignedAreas.includes(a.area_id);
      return `
        <div class="district-card ${isSelected ? 'selected' : ''}" data-id="${a.area_id}" onclick="toggleAreaSelection(${a.area_id})">
          <div class="district-card-info">
            <span class="district-card-name">${escapeHtml(a.area_name)}</span>
            <span class="district-card-div">${escapeHtml(a.division)} · ${escapeHtml(a.region_type)}</span>
          </div>
          <div class="district-card-check">
            <svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        </div>
      `;
    }).join("");

    updateAssignmentProgress();
  }

  window.toggleAreaSelection = function(areaId) {
    const idx = currentAssignedAreas.indexOf(areaId);
    if (idx >= 0) currentAssignedAreas.splice(idx, 1);
    else currentAssignedAreas.push(areaId);
    renderUserAreasGrid();
  };

  function updateAssignmentProgress() {
    const countText = document.getElementById("assignment-progress-text");
    const progressBar = document.getElementById("assignment-progress-bar");
    const total = allAreas.length || 64;
    const selectedCount = currentAssignedAreas.length;
    const pct = Math.round((selectedCount / total) * 100);

    if (countText) countText.textContent = `${selectedCount} / ${total} Districts (${pct}%)`;
    if (progressBar) progressBar.style.width = `${pct}%`;
  }

  document.getElementById("user-areas-cancel-btn")?.addEventListener("click", () => {
    document.getElementById("user-areas-modal")?.classList.remove("open");
  });
  document.getElementById("user-areas-close-x")?.addEventListener("click", () => {
    document.getElementById("user-areas-modal")?.classList.remove("open");
  });

  document.getElementById("user-areas-save-btn")?.addEventListener("click", async () => {
    if (!selectedUserIdForModal) return;
    try {
      await api(`/users/${selectedUserIdForModal}/areas`, {
        method: "PUT",
        body: { area_ids: currentAssignedAreas }
      });
      showToast("Area assignments saved successfully!", "success");
      document.getElementById("user-areas-modal")?.classList.remove("open");
      loadUsers();
    } catch (e) {
      showToast("Failed to save area assignments: " + e.message, "error");
    }
  });

  // Initial render
  switchSection("overview");
});
