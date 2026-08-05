/* ============================================================================
   Load Shedding Management System — API & Auth Client Library
   Includes support for daily_frequency, areas, complaints, outage schedules,
   high risk zones, monthly analysis, authority actions, and user area mapping.
   ============================================================================ */

const API_BASE = window.API_BASE_URL || "/api";

const Auth = {
  getToken() {
    return localStorage.getItem("lsms_token");
  },
  getUser() {
    const raw = localStorage.getItem("lsms_user");
    return raw ? JSON.parse(raw) : null;
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
    return !!this.getToken();
  }
};

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
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
    toast.style.transition = "opacity 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------------------------------------------------------------------------
// Mock Data Generator for Standalone / Offline Execution
// ---------------------------------------------------------------------------
const MOCK_DIVISIONS = ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"];

const MOCK_AREAS = [
  { area_id: 1, area_name: "Dhaka North", division: "Dhaka", region_type: "Urban", zip_code: "1200" },
  { area_id: 2, area_name: "Dhaka South", division: "Dhaka", region_type: "Urban", zip_code: "1000" },
  { area_id: 3, area_name: "Gzipur", division: "Dhaka", region_type: "Semi-Urban", zip_code: "1700" },
  { area_id: 4, area_name: "Chattogram Sadar", division: "Chattogram", region_type: "Urban", zip_code: "4000" },
  { area_id: 5, area_name: "Cox's Bazar", division: "Chattogram", region_type: "Semi-Urban", zip_code: "4700" },
  { area_id: 6, area_name: "Rajshahi City", division: "Rajshahi", region_type: "Urban", zip_code: "6000" },
  { area_id: 7, area_name: "Bogra Sadar", division: "Rajshahi", region_type: "Semi-Urban", zip_code: "5800" },
  { area_id: 8, area_name: "Khulna City", division: "Khulna", region_type: "Urban", zip_code: "9000" },
  { area_id: 9, area_name: "Barishal Sadar", division: "Barishal", region_type: "Urban", zip_code: "8200" },
  { area_id: 10, area_name: "Sylhet Sadar", division: "Sylhet", region_type: "Urban", zip_code: "3100" },
  { area_id: 11, area_name: "Rangpur Sadar", division: "Rangpur", region_type: "Urban", zip_code: "5400" },
  { area_id: 12, area_name: "Mymensingh Sadar", division: "Mymensingh", region_type: "Urban", zip_code: "2200" }
];

let mockDailyFrequency = [
  { frequency_id: 1, area_id: 1, date: new Date().toISOString().split("T")[0], outage_count: 4, total_outage_hours: 5.5, avg_outage_duration: 1.38 },
  { frequency_id: 2, area_id: 2, date: new Date().toISOString().split("T")[0], outage_count: 3, total_outage_hours: 4.0, avg_outage_duration: 1.33 },
  { frequency_id: 3, area_id: 3, date: new Date().toISOString().split("T")[0], outage_count: 6, total_outage_hours: 8.5, avg_outage_duration: 1.42 },
  { frequency_id: 4, area_id: 4, date: new Date().toISOString().split("T")[0], outage_count: 5, total_outage_hours: 6.0, avg_outage_duration: 1.20 },
  { frequency_id: 5, area_id: 5, date: new Date().toISOString().split("T")[0], outage_count: 7, total_outage_hours: 9.5, avg_outage_duration: 1.36 },
  { frequency_id: 6, area_id: 6, date: new Date().toISOString().split("T")[0], outage_count: 2, total_outage_hours: 2.5, avg_outage_duration: 1.25 },
  { frequency_id: 7, area_id: 10, date: new Date().toISOString().split("T")[0], outage_count: 5, total_outage_hours: 7.0, avg_outage_duration: 1.40 }
];

let mockComplaints = [
  { complaint_id: 101, citizen_id: 1, full_name: "Rahim Uddin", phone: "01711223344", area_id: 1, area_name: "Dhaka North", reported_at: "2026-08-04 14:30", description: "Unscheduled power outage lasted 4 hours outside maintenance slot.", status: "open" },
  { complaint_id: 102, citizen_id: 2, full_name: "Nusrat Jahan", phone: "01822334455", area_id: 3, area_name: "Gazipur", reported_at: "2026-08-05 09:15", description: "Transformer explosion caused local feeder shutdown.", status: "in_review" },
  { complaint_id: 103, citizen_id: 3, full_name: "Karim Chowdhury", phone: "01933445566", area_id: 5, area_name: "Cox's Bazar", reported_at: "2026-08-03 18:00", description: "Frequent voltage fluctuations and 5 load shedding cycles today.", status: "resolved", resolution_note: "Feeder load rebalanced by area officer." }
];

let mockSchedules = [
  { schedule_id: 1, area_id: 1, area_name: "Dhaka North", schedule_date: new Date().toISOString().split("T")[0], start_time: "10:00", end_time: "12:00", duration_hours: 2.0, reason: "Grid Substation Maintenance" },
  { schedule_id: 2, area_id: 4, area_name: "Chattogram Sadar", schedule_date: new Date().toISOString().split("T")[0], start_time: "14:00", end_time: "16:30", duration_hours: 2.5, reason: "Feeder Cable Replacement" }
];

let mockHighRisk = [
  { zone_id: 1, area_id: 3, area_name: "Gazipur", division: "Dhaka", region_type: "Semi-Urban", month: 8, year: 2026, risk_level: "Critical", flagged_reason: "High industrial load overflow & transformer overheating", flagged_date: "2026-08-01" },
  { zone_id: 2, area_id: 5, area_name: "Cox's Bazar", division: "Chattogram", region_type: "Semi-Urban", month: 8, year: 2026, risk_level: "High", flagged_reason: "Peak summer tourist demand & supply gap", flagged_date: "2026-08-02" }
];

let mockUsers = [
  { user_id: 1, user_name: "admin", role: "admin", contact_email: "admin@lsms.gov.bd", assigned_areas: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { user_id: 2, user_name: "officer.dhaka", role: "officer", contact_email: "officer.dhaka@lsms.gov.bd", assigned_areas: [1,2,3] }
];

let mockActions = [
  { action_id: 1, user_id: 2, user_name: "officer.dhaka", area_id: 1, area_name: "Dhaka North", action_type: "Emergency Repair Dispatch", notes: "Dispatched maintenance crew to repair feeder #4 jumper line.", action_time: "2026-08-05 10:30" }
];

// ---------------------------------------------------------------------------
// Unified API Call Handler with Server & Offline Fallback Support
// ---------------------------------------------------------------------------
async function api(endpoint, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(API_BASE + endpoint, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `API request failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    // If backend endpoint isn't running, gracefully fulfill with Mock Data
    console.warn(`[LSMS API] Falling back to client-side mock data for ${endpoint}:`, err.message);
    return handleMockApi(endpoint, options);
  }
}

function handleMockApi(endpoint, options) {
  const method = (options.method || "GET").toUpperCase();
  const urlParts = endpoint.split("?");
  const path = urlParts[0];
  const queryStr = urlParts[1] || "";
  const params = new URLSearchParams(queryStr);

  // Auth / Login
  if (path === "/auth/login" && method === "POST") {
    const { user_name, password } = options.body;
    if (password === "password123" || password.length >= 4) {
      const user = mockUsers.find(u => u.user_name === user_name) || { user_id: 99, user_name, role: "officer", assigned_areas: [1,2] };
      return { token: "mock_jwt_token_" + Date.now(), user };
    }
    throw new Error("Invalid credentials. (Demo password: password123)");
  }

  // Summary Analytics
  if (path === "/analytics/summary") {
    const openComplaints = mockComplaints.filter(c => c.status === "open" || c.status === "in_review").length;
    return {
      totalDistricts: MOCK_AREAS.length,
      openComplaints,
      highRiskCount: mockHighRisk.length,
      avgOutagePct: 14.5
    };
  }

  // Areas
  if (path === "/areas") {
    if (method === "GET") return MOCK_AREAS;
    if (method === "POST") {
      const newArea = { area_id: MOCK_AREAS.length + 1, ...options.body };
      MOCK_AREAS.push(newArea);
      return newArea;
    }
  }

  // Daily Frequency (daily_frequency)
  if (path.startsWith("/daily-frequency")) {
    if (method === "GET") {
      let list = mockDailyFrequency.map(df => {
        const area = MOCK_AREAS.find(a => a.area_id === df.area_id) || {};
        return {
          ...df,
          area_name: area.area_name || `District #${df.area_id}`,
          division: area.division || "Dhaka",
          region_type: area.region_type || "Urban"
        };
      });
      const areaFilter = params.get("area_id");
      const dateFilter = params.get("date");
      if (areaFilter) list = list.filter(df => df.area_id == areaFilter);
      if (dateFilter) list = list.filter(df => df.date === dateFilter);
      return list;
    }
    if (method === "POST") {
      const { area_id, date, outage_count, total_outage_hours } = options.body;
      const count = Number(outage_count) || 0;
      const hours = Number(total_outage_hours) || 0;
      const avg = count > 0 ? Number((hours / count).toFixed(2)) : 0;

      const existingIdx = mockDailyFrequency.findIndex(df => df.area_id == area_id && df.date === date);
      let newItem;
      if (existingIdx >= 0) {
        mockDailyFrequency[existingIdx] = {
          ...mockDailyFrequency[existingIdx],
          outage_count: count,
          total_outage_hours: hours,
          avg_outage_duration: avg
        };
        newItem = mockDailyFrequency[existingIdx];
      } else {
        newItem = {
          frequency_id: mockDailyFrequency.length + 1,
          area_id: Number(area_id),
          date,
          outage_count: count,
          total_outage_hours: hours,
          avg_outage_duration: avg
        };
        mockDailyFrequency.unshift(newItem);
      }
      return newItem;
    }
  }

  // Complaints
  if (path.startsWith("/complaints")) {
    if (method === "GET") {
      return mockComplaints.map(c => {
        const area = MOCK_AREAS.find(a => a.area_id === c.area_id) || {};
        return { ...c, area_name: area.area_name || "District #" + c.area_id, division: area.division };
      });
    }
    if (method === "POST") {
      const area = MOCK_AREAS.find(a => a.area_id === options.body.area_id) || {};
      const newC = {
        complaint_id: mockComplaints.length + 101,
        citizen_id: Math.floor(Math.random() * 900) + 100,
        ...options.body,
        area_name: area.area_name || "District",
        reported_at: new Date().toISOString().replace("T", " ").substring(0, 16),
        status: "open"
      };
      mockComplaints.unshift(newC);
      return newC;
    }
    if (method === "PUT") {
      const parts = path.split("/");
      const id = Number(parts[parts.length - 1]);
      const idx = mockComplaints.findIndex(c => c.complaint_id === id);
      if (idx >= 0) {
        mockComplaints[idx] = { ...mockComplaints[idx], ...options.body };
        return mockComplaints[idx];
      }
    }
  }

  // Schedules
  if (path === "/schedules") {
    if (method === "GET") {
      return mockSchedules.map(s => {
        const area = MOCK_AREAS.find(a => a.area_id === s.area_id) || {};
        return { ...s, area_name: area.area_name || "District #" + s.area_id };
      });
    }
    if (method === "POST") {
      const area = MOCK_AREAS.find(a => a.area_id === options.body.area_id) || {};
      const newS = { schedule_id: mockSchedules.length + 1, ...options.body, area_name: area.area_name };
      mockSchedules.unshift(newS);
      return newS;
    }
  }

  // High Risk Zones
  if (path === "/high-risk") {
    if (method === "GET") return mockHighRisk;
    if (method === "POST") {
      const area = MOCK_AREAS.find(a => a.area_id === options.body.area_id) || {};
      const newR = {
        zone_id: mockHighRisk.length + 1,
        ...options.body,
        area_name: area.area_name,
        division: area.division,
        region_type: area.region_type
      };
      mockHighRisk.unshift(newR);
      return newR;
    }
  }

  // Actions
  if (path === "/actions") {
    if (method === "GET") return mockActions;
    if (method === "POST") {
      const user = Auth.getUser() || { user_name: "officer" };
      const area = MOCK_AREAS.find(a => a.area_id === options.body.area_id) || {};
      const newA = {
        action_id: mockActions.length + 1,
        user_id: user.user_id || 1,
        user_name: user.user_name,
        ...options.body,
        area_name: area.area_name,
        action_time: new Date().toISOString().replace("T", " ").substring(0, 16)
      };
      mockActions.unshift(newA);
      return newA;
    }
  }

  // Users
  if (path === "/users") {
    if (method === "GET") return mockUsers;
    if (method === "POST") {
      const newUser = { user_id: mockUsers.length + 1, ...options.body, assigned_areas: [] };
      mockUsers.push(newUser);
      return newUser;
    }
  }

  // User Area Assignments (M:N)
  if (path.startsWith("/users/") && path.endsWith("/areas")) {
    const parts = path.split("/");
    const userId = Number(parts[2]);
    const u = mockUsers.find(user => user.user_id === userId);
    if (method === "GET") return u ? u.assigned_areas : [];
    if (method === "PUT") {
      if (u) u.assigned_areas = options.body.area_ids || [];
      return { success: true, assigned_areas: u ? u.assigned_areas : [] };
    }
  }

  // Monthly Analysis
  if (path.startsWith("/monthly-analysis")) {
    return [
      { analysis_id: 1, area_id: 1, area_name: "Dhaka North", division: "Dhaka", month: 8, year: 2026, outage_percentage: 12.4, avg_daily_hours: 3.0, total_outages: 32, improvement_status: "improved" },
      { analysis_id: 2, area_id: 2, area_name: "Dhaka South", division: "Dhaka", month: 8, year: 2026, outage_percentage: 14.1, avg_daily_hours: 3.4, total_outages: 38, improvement_status: "stable" },
      { analysis_id: 3, area_id: 3, area_name: "Gazipur", division: "Dhaka", month: 8, year: 2026, outage_percentage: 24.8, avg_daily_hours: 6.0, total_outages: 64, improvement_status: "worsened" },
      { analysis_id: 4, area_id: 4, area_name: "Chattogram Sadar", division: "Chattogram", month: 8, year: 2026, outage_percentage: 16.5, avg_daily_hours: 4.0, total_outages: 42, improvement_status: "stable" },
      { analysis_id: 5, area_id: 5, area_name: "Cox's Bazar", division: "Chattogram", month: 8, year: 2026, outage_percentage: 18.2, avg_daily_hours: 4.4, total_outages: 45, improvement_status: "worsened" },
      { analysis_id: 6, area_id: 6, area_name: "Rajshahi City", division: "Rajshahi", month: 8, year: 2026, outage_percentage: 10.5, avg_daily_hours: 2.5, total_outages: 26, improvement_status: "improved" },
      { analysis_id: 7, area_id: 10, area_name: "Sylhet Sadar", division: "Sylhet", month: 8, year: 2026, outage_percentage: 15.0, avg_daily_hours: 3.6, total_outages: 35, improvement_status: "improved" }
    ];
  }

  return [];
}
