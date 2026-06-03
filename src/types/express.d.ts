import { AuthenticatedUser } from './auth';

// Augment Express's Request so `req.user` is typed on protected routes.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
