import { Router, Response } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// Helper: get the user's cart, creating one if it doesn't exist yet
async function getOrCreateCart(userId: number) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: { include: { product: true } } },
    });
  }

  return cart;
}

// GET /api/cart — view my cart
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cart = await getOrCreateCart(req.user!.userId);
    res.json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});

// POST /api/cart/items — add an item to my cart
router.post("/items", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ error: "productId and quantity are required" });
    }

    const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const cart = await getOrCreateCart(req.user!.userId);

    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: Number(productId) },
    });

    let item;
    if (existingItem) {
      item = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + Number(quantity) },
      });
    } else {
      item = await prisma.cartItem.create({
        data: { cartId: cart.id, productId: Number(productId), quantity: Number(quantity) },
      });
    }

    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

// PUT /api/cart/items/:itemId — update quantity
router.put("/items/:itemId", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "quantity must be at least 1" });
    }

    const cart = await getOrCreateCart(req.user!.userId);

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });

    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const updated = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: Number(quantity) },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

// DELETE /api/cart/items/:itemId — remove an item
router.delete("/items/:itemId", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const cart = await getOrCreateCart(req.user!.userId);

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });

    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove cart item" });
  }
});

export default router;