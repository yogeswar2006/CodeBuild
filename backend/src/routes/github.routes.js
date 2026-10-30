import express from "express";
import controller from "../controllers/github.controller.js";
import ProtectedRoute from "../middlewares/auth.middleware.js";

const router = express.Router();

// The callback is not behind ProtectedRoute: GitHub sends the browser here from another
// site, and it identifies the user through the signed `state` instead.
router.get("/callback", controller.handleCallback);

router.post("/connect", ProtectedRoute, controller.startConnect);
router.get("/status", ProtectedRoute, controller.getStatus);
router.delete("/", ProtectedRoute, controller.disconnect);

export default router;