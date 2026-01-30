import express from 'express';
import { getLoginPage, postLogin } from '../controllers/authController.js'

const router = express.Router();

router.get('/', getLoginPage);
router.post('/login', postLogin);

export default router; 