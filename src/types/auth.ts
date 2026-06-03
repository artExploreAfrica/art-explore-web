import { Role } from '@prisma/client';

/** Payload encoded inside the access & refresh JWTs. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
}

/** Shape attached to req.user after the authenticate middleware runs. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}
