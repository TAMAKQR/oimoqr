import express from 'express';
import { getTrialConfig } from '../controllers/admin.controller.js';

const router = express.Router();

router.get('/trial-config', getTrialConfig);

export default router;
