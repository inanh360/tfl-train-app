import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";

// Extends Express's Request type so downstream handlers can read
// req.userId without casting to `any` everywhere.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Verifies the "Authorization: Bearer <token>" header against Supabase
// Auth. Replaces the earlier x-user-id stand-in — that header let anyone
// impersonate any user just by sending a different id, which is fine on
// localhost but not once this is on a public domain. This middleware
// actually checks the token was issued by Supabase for a real signed-in
// session, and pulls the user id from that verified token rather than
// trusting whatever the client claims.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing Authorization: Bearer <token> header" });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  req.userId = data.user.id;
  next();
}
