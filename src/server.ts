import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import { requireAuth, requireAdmin } from "./middleware/auth";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.get("/api/admin-only-test", requireAuth, requireAdmin, (req, res) => {
  res.json({ message: "You are an admin, access granted." });
});

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));