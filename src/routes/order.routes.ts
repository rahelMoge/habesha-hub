import { Router, Response } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/orders — create an order from my cart
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { addressId, deliveryContactPhone } = req.body;

    if (!addressId || !deliveryContactPhone) {
      return res.status(400).json({ error: "addressId and deliveryContactPhone are required" });
    }

    const userId = req.user!.userId;

    // Confirm the address belongs to this user
    const address = await prisma.address.findFirst({ where: { id: Number(addressId), userId } });
    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    // Get the cart with items and product details
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Your cart is empty" });
    }

    // Check stock availability before committing to anything
    for (const item of cart.items) {
      if (item.quantity > item.product.stockQuantity) {
        return res.status(400).json({
          error: `Not enough stock for "${item.product.name}". Available: ${item.product.stockQuantity}`,
        });
      }
    }

    const totalAmount = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    // Everything below either ALL succeeds, or ALL rolls back
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          addressId: Number(addressId),
          orderType: "READY_MADE",
          totalAmount,
          deliveryContactPhone,
          status: "PENDING",
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              quantity: item.quantity,
              unitPrice: item.product.price,
            })),
          },
        },
        include: { items: true },
      });

      // Reduce stock for each product
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // Empty the cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// GET /api/orders — my order history
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId },
      include: { items: true, payment: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:id — one order's detail
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user!.userId },
      include: { items: true, payment: true, address: true },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

export default router;