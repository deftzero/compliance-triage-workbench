import type { ApiError } from "@repo/shared";
import ky, { HTTPError } from "ky";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * Single ky instance for the backend. The trailing slash on `baseUrl` matters:
 * it's resolved per the URL spec, so callers pass relative paths like
 * api.get("v1/users").
 */
export const api = ky.create({
  baseUrl: `${apiUrl}/api/`,
  retry: 0,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = localStorage.getItem("token");
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
  },
});

/**
 * The backend returns every failure as `ApiError`, so surface its message
 * rather than ky's generic "Request failed with status code 400".
 */
export async function toReadableError(error: unknown): Promise<Error> {
  if (error instanceof HTTPError) {
    try {
      const body = (await error.response.json()) as ApiError;
      return new Error(body.error.message);
    } catch {
      return new Error(`Request failed (${error.response.status})`);
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}
