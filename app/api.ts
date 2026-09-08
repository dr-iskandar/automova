export const apiBase = () => {
  if (typeof window === "undefined") return "http://127.0.0.1:3100/api";
  return "/api";
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(payload.error || "Database server tidak merespons");
  return payload as T;
}
