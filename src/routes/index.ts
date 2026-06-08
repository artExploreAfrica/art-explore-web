import { Router } from 'express';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import institutionRoutes from './institution.routes';
import subCategoryRoutes from './subCategory.routes';
import submissionRoutes from './submission.routes';
import tagRoutes from './tag.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/institutions', institutionRoutes);
router.use('/subcategories', subCategoryRoutes);
router.use('/tags', tagRoutes);
router.use('/submissions', submissionRoutes);
router.use('/admin', adminRoutes);

export default router;
