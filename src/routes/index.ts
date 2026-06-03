import { Router } from 'express';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import institutionRoutes from './institution.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/institutions', institutionRoutes);
router.use('/admin', adminRoutes);

export default router;
