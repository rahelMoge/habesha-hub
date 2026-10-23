import { Router, Response, Request } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/payments/initialize/:orderId — start a payment for an order
router.post("/initialize/:orderId", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const orderId = Number(req.params.orderId);
    const userId = req.user!.userId;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true, user: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!order.totalAmount) {
      return res.status(400).json({ error: "Order has no total amount set yet" });
    }

    if (order.payment?.status === "PAID") {
      return res.status(400).json({ error: "Order is already paid" });
    }

    // Chapa v2 limits the reference to 20 characters, so keep it short
    const txRef = `hh${order.id}-${Date.now().toString(36)}`;
    const nameParts = order.user.fullName.split(" ");

    const chapaResponse = await fetch("https://api.chapa.global/v2/payments/hosted", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: order.totalAmount,
        currency: "ETB",
        merchant_reference: txRef,
        customer: {
          first_name: nameParts[0] || "Customer",
          last_name: nameParts[1] || "Customer",
          email: order.user.email,
        },
        meta: {
          order_id: order.id.toString(),
        },
      }),
    });

    const chapaData = await chapaResponse.json();

    if (chapaData.status !== "success") {
      console.error("Chapa initialization failed:", chapaData);
      return res.status(502).json({ error: "Failed to initialize payment with Chapa" });
    }

    await prisma.payment.upsert({
      where: { orderId: order.id },
      update: { transactionRef: txRef, amount: order.totalAmount, status: "PENDING", provider: "chapa" },
      create: {
        orderId: order.id,
        amount: order.totalAmount,
        provider: "chapa",
        transactionRef: txRef,
        status: "PENDING",
      },
    });

    res.json({ checkoutUrl: chapaData.data.checkout_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// POST /api/payments/webhook — Chapa calls this when payment status changes
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const chapaSignature = req.headers["x-chapa-signature"] as string;
    const rawBody = (req as any).rawBody;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.CHAPA_WEBHOOK_SECRET as string)
      .update(rawBody)
      .digest("hex");

    const signatureValid =
      typeof chapaSignature === "string" &&
      /^[a-f0-9]{64}$/i.test(chapaSignature) &&
      crypto.timingSafeEqual(Buffer.from(chapaSignature, "hex"), Buffer.from(expectedSignature, "hex"));

    if (!signatureValid) {
      console.warn("Webhook signature mismatch — rejecting");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;
    const txRef = event.merchant_reference;

    const payment = await prisma.payment.findUnique({ where: { transactionRef: txRef } });
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Idempotency: Chapa may send the same event twice, or events out of order.
    // Once a payment is PAID, acknowledge and change nothing.
    if (payment.status === "PAID") {
      return res.status(200).json({ received: true });
    }

    if (event.event === "payment.success") {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", paidAt: new Date() },
        }),
        prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "CONFIRMED" },
        }),
      ]);
    } else if (event.event === "payment.failed" || event.event === "payment.cancelled") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
    }
    // Other events (incomplete, auth_needed, blocked) are left as-is for now

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;