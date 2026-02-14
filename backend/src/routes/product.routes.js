import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
    getProductCategories,
    createProductCategory,
    updateProductCategory,
    deleteProductCategory,
    getProducts,
    getRestaurantProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductImage,
    deleteProductImage,
    updateStock
} from '../controllers/product.controller.js';

const router = express.Router();

// Product Categories
router.get('/categories/:restaurantId', getProductCategories);
router.post('/categories', authenticate, createProductCategory);
router.put('/categories/:id', authenticate, updateProductCategory);
router.delete('/categories/:id', authenticate, deleteProductCategory);

// Products
router.get('/category/:categoryId', getProducts);
router.get('/restaurant/:restaurantId', getRestaurantProducts);
router.post('/', authenticate, createProduct);
router.put('/:id', authenticate, updateProduct);
router.delete('/:id', authenticate, deleteProduct);

// Product images
router.post('/:id/upload-image', authenticate, upload.single('image'), uploadProductImage);
router.delete('/:id/delete-image', authenticate, deleteProductImage);

// Stock management
router.patch('/:id/stock', authenticate, updateStock);
export default router;
