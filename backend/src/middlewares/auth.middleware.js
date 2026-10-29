import { getUserFromToken } from "../lib/auth.js";

const ProtectedRoute = async (req, res, next) => {
  const user = await getUserFromToken(req.cookies.jwt);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  req.user = user;
  next();
};

export default ProtectedRoute;