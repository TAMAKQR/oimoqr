const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const checkAccess = require('../middleware/checkAccess');
const upload = require('../middleware/upload');

// Public route to get products for a restaurant
router.get('/restaurant/:restaurantId', productController.getProductsByRestaurant);

// Protected routes - require ownership
router.post('/', checkAccess('restaurant'), productController.createProduct);

router.put('/:id', checkAccess('product'), productController.updateProduct);

router.delete('/:id', checkAccess('product'), productController.deleteProduct);

// FIX: Add checkAccess middleware to the upload route
router.post(
    '/:id/upload-image',
    checkAccess('product'),
    upload.single('image'),
    productController.uploadProductImage
);

module.exports = router;