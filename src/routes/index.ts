import { Router } from 'express';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import exhibitionRoutes from './exhibition.routes';
import institutionRoutes from './institution.routes';
import reviewRoutes from './review.routes';
import subCategoryRoutes from './subCategory.routes';
import submissionRoutes from './submission.routes';
import tagRoutes from './tag.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/institutions', institutionRoutes);
router.use('/exhibitions', exhibitionRoutes);
router.use('/subcategories', subCategoryRoutes);
router.use('/tags', tagRoutes);
router.use('/reviews', reviewRoutes);
router.use('/submissions', submissionRoutes);
router.use('/admin', adminRoutes);

export default router;
