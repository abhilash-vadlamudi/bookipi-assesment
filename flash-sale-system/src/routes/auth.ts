import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/AuthController';
import middleware from '../middleware';

const router = Router();
const authController = new AuthController();

// Authentication routes with validation
router.post('/register', 
  middleware.authValidation,
  middleware.validateInput(middleware.authValidation),
  (req: Request, res: Response) => authController.register(req, res)
);

router.post('/login',
  middleware.authValidation,
  middleware.validateInput(middleware.authValidation),
  (req: Request, res: Response) => authController.login(req, res)
);

router.get('/profile',
  middleware.authenticate,
  (req: Request, res: Response) => authController.getProfile(req, res)
);

router.put('/profile',
  middleware.authenticate,
  middleware.profileUpdateValidation,
  middleware.validateInput(middleware.profileUpdateValidation),
  (req: Request, res: Response) => authController.updateProfile(req, res)
);

router.post('/logout',
  middleware.authenticate,
  (req: Request, res: Response) => authController.logout(req, res)
);

router.post('/change-password',
  middleware.authenticate,
  // Add password change validation here
  (req: Request, res: Response) => authController.changePassword(req, res)
);

export default router;
