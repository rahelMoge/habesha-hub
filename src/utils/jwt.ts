import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: number;
  role: "ADMIN" | "CUSTOMER";
}

export function signToken(payload: JwtPayload): string {
  const JWT_SECRET = process.env.JWT_SECRET as string;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  const JWT_SECRET = process.env.JWT_SECRET as string;
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}