import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { upload } from "../utils/upload";

const router = Router();

// GET /api/products — public, list all products (with filters)
router.get("/", async (req, res) => {
  try {
    const { categoryId, condition, minPrice, maxPrice } = req.query;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId && { categoryId: Number(categoryId) }),
        ...(condition && { condition: condition as "NEW" | "USED" }),
        ...(minPrice || maxPrice
          ? {
              price: {
                ...(minPrice && { gte: Number(minPrice) }),
                ...(maxPrice && { lte: Number(maxPrice) }),
              },
            }
          : {}),
      },
      include: { category: true, images: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/:id — public, get one product
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true, images: true, reviews: true },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// POST /api/products — admin only, create a product with images
router.post("/", requireAuth, requireAdmin, upload.array("images", 5), async (req, res) => {
  try {
    const { name, description, price, condition, stockQuantity, categoryId } = req.body;

    if (!name || !price || !categoryId) {
      return res.status(400).json({ error: "name, price, and categoryId are required" });
    }

    const files = req.files as Express.Multer.File[];

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: Number(price),
        condition: condition || "NEW",
        stockQuantity: stockQuantity ? Number(stockQuantity) : 1,
        categoryId: Number(categoryId),
        images: {
          create: files?.map((file, index) => ({
            imageUrl: `/uploads/${file.filename}`,
            isPrimary: index === 0,
          })) || [],
        },
      },
      include: { images: true, category: true },
    });

    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/products/:id — admin only, update a product
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, price, condition, stockQuantity, categoryId, isActive } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price && { price: Number(price) }),
        ...(condition && { condition }),
        ...(stockQuantity !== undefined && { stockQuantity: Number(stockQuantity) }),
        ...(categoryId && { categoryId: Number(categoryId) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(product);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /api/products/:id — admin only, delete a product
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;