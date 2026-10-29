import express from "express";
import projectController from "../controllers/project.controller.js";
import ProtectedRoute from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(ProtectedRoute);

// Projects
router.get("/", projectController.getAllCurrentUserProjects);
router.post("/", projectController.createProject);
router.get("/:projectId", projectController.getProjectById);
router.patch("/:projectId", projectController.updateProject);
router.delete("/:projectId", projectController.deleteProject);

// File explorer
router.get("/:projectId/tree", projectController.getProjectHeirarchy);

// Files and folders inside a project (identified by ?path= or body path)
router.post("/:projectId/nodes", projectController.createFileNode);
router.patch("/:projectId/nodes", projectController.renameNode);
router.delete("/:projectId/nodes", projectController.deleteNode);

// File content
router.get("/:projectId/file", projectController.getFileContent);
router.put("/:projectId/file", projectController.updateFileContent);

router.post("/:projectId/search", projectController.searchFiles);
router.post("/:projectId/replace", projectController.replaceInFiles);

export default router;