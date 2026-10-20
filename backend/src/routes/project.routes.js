import express from "express";
import projectController from "../controllers/project.controller.js";
import ProtectedRoute from "../middlewares/auth.middleware.js";

const router= express.Router();
router.use(ProtectedRoute)

router.post("/create",ProtectedRoute,projectController.createProject);
router.get("/fetch",projectController.getAllCurrentUserProjects);
router.get("/fetch/:id",projectController.getProjectById);
router.patch("/update/:id",projectController.updateProject);
router.delete("/delete/:id",projectController.deleteProject);


export default router

