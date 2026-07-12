import type { PublicUser, User } from "@repo/shared";

/** Strips the password hash. Every path out of the API goes through this. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
