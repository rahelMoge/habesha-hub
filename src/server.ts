import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import { requireAuth, requireAdmin } from "./middleware/auth";
import categoryRoutes from "./routes/category.routes"; 
import path from "path";
import productRoutes from "./routes/product.routes";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.get("/api/admin-only-test", requireAuth, requireAdmin, (req, res) => {
  res.json({ message: "You are an admin, access granted." });
});

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));