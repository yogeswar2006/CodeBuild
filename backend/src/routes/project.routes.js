import express from "express";
import projectController from "../controllers/project.controller.js";
import ProtectedRoute from "../middlewares/auth.middleware.js";
import gitController from "../controllers/git.controller.js";

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




router.get("/:projectId/git/status", gitController.status);
router.post("/:projectId/git/init", gitController.init);
router.post("/:projectId/git/stage", gitController.stage);
router.post("/:projectId/git/unstage", gitController.unstage);
router.post("/:projectId/git/commit", gitController.commit);
router.put("/:projectId/git/remote", gitController.setRemote);
router.post("/:projectId/git/push", gitController.push);
router.post("/:projectId/git/pull", gitController.pull);

export default router;