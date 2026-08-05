/* ============================================================================
   Load Shedding Management System — API & Auth Client
   Uses the real Express/MySQL API. Client-side mock data is used only when the
   backend cannot be reached (network failure or file:// preview), never when
   the server returns a validation/authentication error.
   ============================================================================ */

const API_BASE = window.API_BASE_URL || "/api";

const Auth = {
  getToken() {
    return localStorage.getItem("lsms_token");
  },
  getUser() {
    const raw = localStorage.getItem("lsms_user");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setSession(token, user) {
    localStorage.setItem("lsms_token", token);
    localStorage.setItem("lsms_user", JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem("lsms_token");
    localStorage.removeItem("lsms_user");
    window.location.href = "login.html";
  },
  isLoggedIn() {
    return Boolean(this.getToken());
  },
};

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity .3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function api(endpoint, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(API_BASE + endpoint, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    if (!response.ok) {
      throw new ApiError(data.error || data.message || `API request failed (${response.status})`, response.status);
    }
    return data;
  } catch (error) {
    // Server-side errors must be shown to the user; do not pretend they worked.
    if (error instanceof ApiError) throw error;

    // Network failure / direct file preview only.
    console.warn(`[LSMS] Backend unavailable; using temporary mock data for ${endpoint}.`, error);
    return handleMockApi(endpoint, options);
  }
}

// ---------------------------------------------------------------------------
// Offline/demo data. It mirrors the real endpoints used by dashboard.js.
// ---------------------------------------------------------------------------
const nowDate = new Date().toISOString().slice(0, 10);
let mockAreas = [
  { area_id: 1, area_name: "Dhaka", division: "Dhaka", region_type: "Urban", zip_code: "1200" },
  { area_id: 2, area_name: "Gazipur", division: "Dhaka", region_type: "Semi-Urban", zip_code: "1700" },
  { area_id: 3, area_name: "Chattogram", division: "Chattogram", region_type: "Urban", zip_code: "4000" },
  { area_id: 4, area_name: "Cox's Bazar", division: "Chattogram", region_type: "Semi-Urban", zip_code: "4700" },
  { area_id: 5, area_name: "Rajshahi", division: "Rajshahi", region_type: "Urban", zip_code: "6000" },
  { area_id: 6, area_name: "Khulna", division: "Khulna", region_type: "Urban", zip_code: "9000" },
  { area_id: 7, area_name: "Barishal", division: "Barishal", region_type: "Urban", zip_code: "8200" },
  { area_id: 8, area_name: "Sylhet", division: "Sylhet", region_type: "Urban", zip_code: "3100" },
  { area_id: 9, area_name: "Rangpur", division: "Rangpur", region_type: "Urban", zip_code: "5400" },
  { area_id: 10, area_name: "Mymensingh", division: "Mymensingh", region_type: "Urban", zip_code: "2200" },
];
let mockDaily = [
  { frequency_id: 1, area_id: 1, date: nowDate, outage_count: 4, total_outage_hours: 6, avg_outage_duration: 1.5 },
  { frequency_id: 2, area_id: 2, date: nowDate, outage_count: 5, total_outage_hours: 7.5, avg_outage_duration: 1.5 },
];
let mockComplaints = [
  { complaint_id: 1, full_name: "Rahim Uddin", phone: "01700000000", area_id: 1, reported_at: `${nowDate} 09:00:00`, description: "Unscheduled outage outside the published window.", status: "open", resolution_note: null },
  { complaint_id: 2, full_name: "Nusrat Jahan", phone: "01800000000", area_id: 2, reported_at: `${nowDate} 10:00:00`, description: "Transformer sparking near the local feeder.", status: "in_review", resolution_note: null },
];
let mockSchedules = [
  { schedule_id: 1, area_id: 1, schedule_date: nowDate, start_time: "10:00", end_time: "12:00", duration_hours: 2, reason: "Substation maintenance" },
];
let mockHighRisk = [
  { zone_id: 1, area_id: 2, month: 8, year: 2026, risk_level: "Critical", flagged_reason: "Industrial demand exceeds local feeder capacity.", flagged_date: "2026-08-01" },
  { zone_id: 2, area_id: 4, month: 8, year: 2026, risk_level: "High", flagged_reason: "Seasonal peak demand.", flagged_date: "2026-08-02" },
  { zone_id: 3, area_id: 5, month: 7, year: 2026, risk_level: "Medium", flagged_reason: "Repeated feeder faults.", flagged_date: "2026-07-10" },
];
let mockAnalysis = [
  { analysis_id: 1, area_id: 1, month: 8, year: 2026, outage_percentage: 12.4, avg_daily_hours: 3.0, total_outages: 32, improvement_status: "improved" },
  { analysis_id: 2, area_id: 2, month: 8, year: 2026, outage_percentage: 24.8, avg_daily_hours: 6.0, total_outages: 64, improvement_status: "worsened" },
];
let mockActions = [
  { action_id: 1, user_id: 1, user_name: "admin", area_id: 1, action_type: "Site Inspection", notes: "Inspection team dispatched.", action_time: `${nowDate} 11:00:00`, complaint_id: null },
];
let mockUsers = [
  { user_id: 1, user_name: "admin", role: "admin", contact_email: "admin@lsms.gov.bd", assigned_areas: mockAreas.map((area) => area.area_id) },
  { user_id: 2, user_name: "officer.dhaka", role: "officer", contact_email: "dhaka@lsms.gov.bd", assigned_areas: [1, 2] },
];

function nextId(rows, key) {
  return rows.reduce((max, row) => Math.max(max, Number(row[key]) || 0), 0) + 1;
}

function withArea(row) {
  const area = mockAreas.find((item) => Number(item.area_id) === Number(row.area_id)) || {};
  return { ...row, area_name: area.area_name || `Area #${row.area_id}`, division: area.division || "", region_type: area.region_type || "" };
}

function parseMockRequest(endpoint, options) {
  const [path, query = ""] = endpoint.split("?");
  return {
    path,
    params: new URLSearchParams(query),
    method: String(options.method || "GET").toUpperCase(),
    body: options.body || {},
  };
}

function handleMockApi(endpoint, options = {}) {
  const { path, params, method, body } = parseMockRequest(endpoint, options);

  if (path === "/auth/login" && method === "POST") {
    const user = mockUsers.find((item) => item.user_name === body.user_name) || mockUsers[0];
    return { token: `mock-token-${Date.now()}`, user };
  }

  if (path === "/analytics/summary" && method === "GET") {
    const latestPeriod = mockHighRisk.reduce((max, row) => Math.max(max, row.year * 12 + row.month), 0);
    return {
      totalAreas: mockAreas.length,
      totalDistricts: mockAreas.length,
      openComplaints: mockComplaints.filter((row) => ["open", "in_review"].includes(row.status)).length,
      highRiskCount: mockHighRisk.filter((row) => row.year * 12 + row.month === latestPeriod).length,
      avgOutagePct: mockAnalysis.length ? Number((mockAnalysis.reduce((sum, row) => sum + Number(row.outage_percentage), 0) / mockAnalysis.length).toFixed(1)) : 0,
      byDivision: [],
      topComplaintAreas: [],
    };
  }

  if (path === "/areas") {
    if (method === "GET") return [...mockAreas];
    if (method === "POST") {
      if (mockAreas.some((row) => row.area_name.toLowerCase() === String(body.area_name).toLowerCase())) throw new Error("An area with that name already exists.");
      const row = { area_id: nextId(mockAreas, "area_id"), ...body };
      mockAreas.push(row);
      return row;
    }
  }
  if (/^\/areas\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const index = mockAreas.findIndex((row) => row.area_id === id);
    if (index < 0) throw new Error("Area not found.");
    if (method === "GET") return mockAreas[index];
    if (method === "PUT") return (mockAreas[index] = { ...mockAreas[index], ...body, area_id: id });
    if (method === "DELETE") {
      mockAreas.splice(index, 1);
      return { success: true };
    }
  }

  if (path === "/analytics/daily") {
    if (method === "GET") return mockDaily.map(withArea);
    if (method === "POST") {
      const count = Number(body.outage_count);
      const hours = Number(body.total_outage_hours);
      const row = { frequency_id: nextId(mockDaily, "frequency_id"), ...body, avg_outage_duration: count ? Number((hours / count).toFixed(2)) : 0 };
      mockDaily.push(row);
      return withArea(row);
    }
  }
  if (/^\/analytics\/daily\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const index = mockDaily.findIndex((row) => row.frequency_id === id);
    if (index < 0) throw new Error("Daily record not found.");
    if (method === "PUT") {
      const merged = { ...mockDaily[index], ...body };
      merged.avg_outage_duration = merged.outage_count ? Number((Number(merged.total_outage_hours) / Number(merged.outage_count)).toFixed(2)) : 0;
      mockDaily[index] = merged;
      return withArea(merged);
    }
    if (method === "DELETE") {
      mockDaily.splice(index, 1);
      return { success: true };
    }
  }

  if (path === "/complaints") {
    if (method === "GET") return mockComplaints.map(withArea);
    if (method === "POST") {
      const row = { complaint_id: nextId(mockComplaints, "complaint_id"), ...body, reported_at: new Date().toISOString().replace("T", " ").slice(0, 19), status: "open", resolution_note: null };
      mockComplaints.unshift(row);
      return withArea(row);
    }
  }
  if (/^\/complaints\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const index = mockComplaints.findIndex((row) => row.complaint_id === id);
    if (index < 0) throw new Error("Complaint not found.");
    if (method === "PUT") return (mockComplaints[index] = { ...mockComplaints[index], ...body });
    if (method === "DELETE") {
      mockComplaints.splice(index, 1);
      return { success: true };
    }
  }

  if (path === "/schedules") {
    if (method === "GET") return mockSchedules.map(withArea);
    if (method === "POST") {
      const row = { schedule_id: nextId(mockSchedules, "schedule_id"), ...body };
      mockSchedules.push(row);
      return withArea(row);
    }
  }
  if (/^\/schedules\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const index = mockSchedules.findIndex((row) => row.schedule_id === id);
    if (index < 0) throw new Error("Schedule not found.");
    if (method === "PUT") return withArea((mockSchedules[index] = { ...mockSchedules[index], ...body }));
    if (method === "DELETE") {
      mockSchedules.splice(index, 1);
      return { success: true };
    }
  }

  if (path === "/analytics/high-risk") {
    if (method === "GET") {
      let rows = [...mockHighRisk];
      const year = params.get("year");
      const month = params.get("month");
      if (year) rows = rows.filter((row) => Number(row.year) === Number(year));
      if (month) rows = rows.filter((row) => Number(row.month) === Number(month));
      return rows.map(withArea);
    }
    if (method === "POST") {
      const row = { zone_id: nextId(mockHighRisk, "zone_id"), ...body };
      mockHighRisk.push(row);
      return withArea(row);
    }
  }
  if (/^\/analytics\/high-risk\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const index = mockHighRisk.findIndex((row) => row.zone_id === id);
    if (index < 0) throw new Error("High-risk record not found.");
    if (method === "PUT") return withArea((mockHighRisk[index] = { ...mockHighRisk[index], ...body }));
    if (method === "DELETE") {
      mockHighRisk.splice(index, 1);
      return { success: true };
    }
  }

  if (path === "/analytics/monthly") {
    if (method === "GET") return mockAnalysis.map(withArea);
    if (method === "POST") {
      const row = { analysis_id: nextId(mockAnalysis, "analysis_id"), ...body };
      mockAnalysis.push(row);
      return withArea(row);
    }
  }
  if (/^\/analytics\/monthly\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const index = mockAnalysis.findIndex((row) => row.analysis_id === id);
    if (index < 0) throw new Error("Monthly analysis not found.");
    if (method === "PUT") return withArea((mockAnalysis[index] = { ...mockAnalysis[index], ...body }));
    if (method === "DELETE") {
      mockAnalysis.splice(index, 1);
      return { success: true };
    }
  }

  if (path === "/actions") {
    if (method === "GET") return mockActions.map(withArea);
    if (method === "POST") {
      const user = Auth.getUser() || mockUsers[0];
      const row = { action_id: nextId(mockActions, "action_id"), user_id: user.user_id, user_name: user.user_name, action_time: new Date().toISOString().replace("T", " ").slice(0, 19), complaint_id: null, ...body };
      mockActions.unshift(row);
      return withArea(row);
    }
  }
  if (/^\/actions\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const index = mockActions.findIndex((row) => row.action_id === id);
    if (index < 0) throw new Error("Authority action not found.");
    if (method === "PUT") return withArea((mockActions[index] = { ...mockActions[index], ...body }));
    if (method === "DELETE") {
      mockActions.splice(index, 1);
      return { success: true };
    }
  }

  if (path === "/users") {
    if (method === "GET") return mockUsers;
    if (method === "POST") {
      const row = { user_id: nextId(mockUsers, "user_id"), user_name: body.user_name, role: body.role || "officer", contact_email: body.contact_email || null, assigned_areas: [] };
      mockUsers.push(row);
      return row;
    }
  }
  if (/^\/users\/\d+\/areas$/.test(path)) {
    const id = Number(path.split("/")[2]);
    const user = mockUsers.find((row) => row.user_id === id);
    if (!user) throw new Error("User not found.");
    if (method === "GET") return user.assigned_areas.map((areaId) => withArea({ area_id: areaId }));
    if (method === "PUT") {
      user.assigned_areas = (body.area_ids || []).map(Number);
      return { user_id: id, assigned_areas: user.assigned_areas };
    }
  }
  if (/^\/users\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const index = mockUsers.findIndex((row) => row.user_id === id);
    if (index < 0) throw new Error("User not found.");
    if (method === "GET") return mockUsers[index];
    if (method === "PUT") return (mockUsers[index] = { ...mockUsers[index], ...body, user_id: id });
    if (method === "DELETE") {
      mockUsers.splice(index, 1);
      return { success: true };
    }
  }

  throw new Error(`No mock handler for ${method} ${path}`);
}