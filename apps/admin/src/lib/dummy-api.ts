import { publicUserSchema, randomDelay, type PublicUser } from "@repo/shared";
import { z } from "zod";

/** Chance a fetch blows up, so the error state is reachable without a real outage. */
const FAILURE_RATE = 0.3;

const RAW_USERS = [
  {
    id: "3f2a1b64-1f0e-4c1d-9b1a-6a5f2f0d1c01",
    email: "ada@example.com",
    name: "Ada Lovelace",
    role: "admin",
    createdAt: "2026-01-14T09:12:00.000Z",
  },
  {
    id: "3f2a1b64-1f0e-4c1d-9b1a-6a5f2f0d1c02",
    email: "grace@example.com",
    name: "Grace Hopper",
    role: "admin",
    createdAt: "2026-02-02T15:40:00.000Z",
  },
  {
    id: "3f2a1b64-1f0e-4c1d-9b1a-6a5f2f0d1c03",
    email: "alan@example.com",
    name: "Alan Turing",
    role: "user",
    createdAt: "2026-03-19T11:05:00.000Z",
  },
  {
    id: "3f2a1b64-1f0e-4c1d-9b1a-6a5f2f0d1c04",
    email: "katherine@example.com",
    name: "Katherine Johnson",
    role: "user",
    createdAt: "2026-04-27T08:30:00.000Z",
  },
];

/**
 * Stands in for `api.get("v1/users")` until the backend is wired up. It runs
 * the payload through the same Zod schema the backend validates with, so the
 * shape is enforced across the package boundary rather than just asserted.
 */
export async function fetchUsers(): Promise<PublicUser[]> {
  await randomDelay(1200, 3000);

  if (Math.random() < FAILURE_RATE) {
    throw new Error("The users service is temporarily unavailable (simulated).");
  }

  return z.array(publicUserSchema).parse(RAW_USERS);
}
