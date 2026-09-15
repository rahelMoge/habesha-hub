import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/categories — public, list all categories
router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/categories/:id — public, get one category
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

// POST /api/categories — admin only, create a category
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const category = await prisma.category.create({
      data: { name, description },
    });

    res.status(201).json(category);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Category name already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/categories/:id — admin only, update a category
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body;

    const category = await prisma.category.update({
      where: { id },
      data: { name, description },
    });

    res.json(category);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/categories/:id — admin only, delete a category
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Category not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;