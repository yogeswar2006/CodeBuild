import express from 'express';
import authController from '../controllers/auth.controllers.js';
import ProtectedRoute from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/register',authController.register);
router.post('/login',authController.login);
router.post('/logout',authController.logout);

router.get('/check',ProtectedRoute,authController.getCurrentUser);


export default router