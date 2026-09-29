import { Router, Response } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/addresses — list my addresses
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.userId },
      orderBy: { isDefault: "desc" },
    });
    res.json(addresses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch addresses" });
  }
});

// POST /api/addresses — add a new address
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { label, city, subCity, area, landmark, phoneNumber, isDefault } = req.body;

    if (!city || !phoneNumber) {
      return res.status(400).json({ error: "city and phoneNumber are required" });
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.userId },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: req.user!.userId,
        label,
        city,
        subCity,
        area,
        landmark,
        phoneNumber,
        isDefault: !!isDefault,
      },
    });

    res.status(201).json(address);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create address" });
  }
});

// PUT /api/addresses/:id — update my address
router.put("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.address.findFirst({
      where: { id, userId: req.user!.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Address not found" });
    }

    const { label, city, subCity, area, landmark, phoneNumber, isDefault } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.userId },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(city && { city }),
        ...(subCity !== undefined && { subCity }),
        ...(area !== undefined && { area }),
        ...(landmark !== undefined && { landmark }),
        ...(phoneNumber && { phoneNumber }),
        ...(isDefault !== undefined && { isDefault: !!isDefault }),
      },
    });

    res.json(address);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update address" });
  }
});

// DELETE /api/addresses/:id — delete my address
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.address.findFirst({
      where: { id, userId: req.user!.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Address not found" });
    }

    await prisma.address.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete address" });
  }
});

export default router;