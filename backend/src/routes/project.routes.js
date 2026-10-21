import express from "express";
import projectController from "../controllers/project.controller.js";
import ProtectedRoute from "../middlewares/auth.middleware.js";

const router= express.Router();
router.use(ProtectedRoute)

router.post("/create",projectController.createProject);
router.get("/fetch",projectController.getAllCurrentUserProjects);
router.get("/fetch/:id",projectController.getProjectById);
router.patch("/update/:id",projectController.updateProject);
router.delete("/delete/:id",projectController.deleteProject);

router.post("/create/filenode",projectController.createFileNode);
router.get("/:projectId/tree",projectController.getProjectHeirarchy);
router.get("/:projectId/files/:fileId",projectController.getFileContent)
router.patch("/:projectId/files/:fileId",projectController.updateFileContent)


export default router

