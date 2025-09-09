import { Router, Request, Response } from 'express';
import { FlashSaleController } from '../controllers/FlashSaleController';
import middleware from '../middleware';

const router = Router();
const flashSaleController = new FlashSaleController();

// Public endpoints
router.get('/', 
  (req: Request, res: Response) => flashSaleController.getAllFlashSales(req, res)
);

router.get('/active', 
  (req: Request, res: Response) => flashSaleController.getActiveFlashSales(req, res)
);

router.get('/:id', 
  (req: Request, res: Response) => flashSaleController.getFlashSaleById(req, res)
);

router.get('/status', 
  (req: Request, res: Response) => flashSaleController.getStatus(req, res)
);

router.post('/purchase', 
  middleware.authenticate,
  middleware.purchaseValidation,
  middleware.validateInput(middleware.purchaseValidation),
  (req: Request, res: Response) => flashSaleController.attemptPurchase(req, res)
);

router.get('/user/:userId/purchase', 
  middleware.authenticate,
  (req: Request, res: Response) => flashSaleController.getUserPurchaseStatus(req, res)
);

router.get('/user/:userId/history', 
  middleware.authenticate,
  (req: Request, res: Response) => flashSaleController.getUserPurchaseHistory(req, res)
);

router.get('/user/:userId/flashsale/:flashSaleId/purchase', 
  middleware.authenticate,
  (req: Request, res: Response) => flashSaleController.getUserFlashSalePurchaseStatus(req, res)
);

// Admin endpoints (protected by authentication and admin role)
router.post('/admin/create', 
  middleware.authenticate,
  middleware.requireAdmin,
  middleware.flashSaleValidation,
  middleware.validateInput(middleware.flashSaleValidation),
  (req: Request, res: Response) => flashSaleController.createFlashSale(req, res)
);

router.put('/:id', 
  middleware.authenticate,
  middleware.requireAdmin,
  middleware.flashSaleUpdateValidation,
  middleware.validateInput(middleware.flashSaleUpdateValidation),
  (req: Request, res: Response) => flashSaleController.updateFlashSale(req, res)
);

router.delete('/:id', 
  middleware.authenticate,
  middleware.requireAdmin,
  (req: Request, res: Response) => flashSaleController.deleteFlashSale(req, res)
);

router.get('/admin/:flashSaleId/stats', 
  middleware.authenticate,
  middleware.requireAdmin,
  (req: Request, res: Response) => flashSaleController.getFlashSaleStats(req, res)
);

export default router;
