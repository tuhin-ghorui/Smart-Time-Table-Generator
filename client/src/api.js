const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export function getPublicOptions() {
  return request("/public/options");
}

export function getPublicTimetable(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/public/timetable${query ? `?${query}` : ""}`);
}

export function getTodaysChanges() {
  return request("/public/changes");
}

export function getTeacherDashboard() {
  return request("/teacher/dashboard");
}

export function getAdminOverview() {
  return request("/admin/overview");
}

export function getSubstitutionRequests() {
  return request("/admin/substitution-requests");
}

export function getBatches() {
  return request("/admin/batches");
}
