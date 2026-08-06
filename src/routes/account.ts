import { Router } from "express";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAuth } from "../middleware/requireAuth";

export const accountRouter = Router();

accountRouter.use(requireAuth);

// DELETE /account — removes the signed-in user's favourites and
// notifications, then deletes their actual Supabase Auth account. This is
// the GDPR "right to erasure" mechanism: once this completes, nothing
// identifying this person remains in either database.
accountRouter.delete("/", async (req, res) => {
  const userId = req.userId as string;

  try {
    // Delete app data first — if this fails partway, the auth account
    // stays intact rather than being deleted while orphaned data remains.
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.favourite.deleteMany({ where: { userId } });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[account] failed to delete Supabase auth user", error);
      res.status(502).json({ error: "Deleted your data, but failed to delete your login. Contact support." });
      return;
    }

    res.status(204).send();
  } catch (err) {
    console.error("[account] deletion failed", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});
