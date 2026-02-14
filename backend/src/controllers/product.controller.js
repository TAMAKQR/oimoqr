import { prisma } from '../config/prisma.js';

// Get all product categories for a store
export const getProductCategories = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const categories = await prisma.productCategory.findMany({
            where: { restaurantId },
            orderBy: { order: 'asc' },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });

        res.json(categories);
    } catch (error) {
        next(error);
    }
};

// Create product category
export const createProductCategory = async (req, res, next) => {
    try {
        const { name, description, order, restaurantId } = req.body;

        const category = await prisma.productCategory.create({
            data: {
                name,
                description,
                order: order || 0,
                restaurantId
            }
        });

        res.status(201).json(category);
    } catch (error) {
        next(error);
    }
};

// Update product category
export const updateProductCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, order, isActive, image } = req.body;

        const category = await prisma.productCategory.update({
            where: { id },
            data: {
                name,
                description,
                order,
                isActive,
                image
            }
        });

        res.json(category);
    } catch (error) {
        next(error);
    }
};

// Delete product category
export const deleteProductCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.productCategory.delete({
            where: { id }
        });

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Get all products
export const getProducts = async (req, res, next) => {
    try {
        const { categoryId } = req.params;

        const products = await prisma.product.findMany({
            where: { categoryId },
            orderBy: { order: 'asc' },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                variants: true
            }
        });

        res.json(products);
    } catch (error) {
        next(error);
    }
};

// Get products by restaurant
export const getRestaurantProducts = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const products = await prisma.product.findMany({
            where: {
                restaurantId,
                available: true
            },
            orderBy: { order: 'asc' },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                variants: true
            }
        });

        res.json(products);
    } catch (error) {
        next(error);
    }
};

// Create product
export const createProduct = async (req, res, next) => {
    try {
        const {
            name,
            description,
            sku,
            price,
            compareAtPrice,
            cost,
            categoryId,
            restaurantId,
            trackInventory,
            stockQuantity,
            weight,
            order
        } = req.body;

        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ error: 'Price must be a number greater than or equal to 0' });
        }

        const product = await prisma.product.create({
            data: {
                name,
                description,
                sku,
                price: parsedPrice,
                compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
                cost: cost ? parseFloat(cost) : null,
                categoryId,
                restaurantId,
                trackInventory: trackInventory !== undefined ? trackInventory : true,
                stockQuantity: stockQuantity || 0,
                weight: weight ? parseFloat(weight) : null,
                order: order || 0
            },
            include: {
                category: true
            }
        });

        res.status(201).json(product);
    } catch (error) {
        next(error);
    }
};

// Update product
export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (updateData.price !== undefined) {
            const parsedPrice = parseFloat(updateData.price);
            if (isNaN(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ error: 'Price must be a number greater than or equal to 0' });
            }
            updateData.price = parsedPrice;
        }

        const product = await prisma.product.update({
            where: { id },
            data: updateData,
            include: {
                category: true,
                variants: true
            }
        });

        res.json(product);
    } catch (error) {
        next(error);
    }
};

// Delete product
export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.product.delete({
            where: { id }
        });

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Upload product image
export const uploadProductImage = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const imageUrl = req.file.path || `/uploads/${req.file.filename}`;
        const currentImages = Array.isArray(product.images) ? product.images : [];
        const updatedImages = [...currentImages, imageUrl];

        const updatedProduct = await prisma.product.update({
            where: { id },
            data: { images: updatedImages },
            include: { category: true }
        });

        res.json(updatedProduct);
    } catch (error) {
        next(error);
    }
};

// Delete product image
export const deleteProductImage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { imageUrl } = req.body;

        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const currentImages = Array.isArray(product.images) ? product.images : [];
        const updatedImages = currentImages.filter(img => img !== imageUrl);

        const updatedProduct = await prisma.product.update({
            where: { id },
            data: { images: updatedImages },
            include: { category: true }
        });

        res.json(updatedProduct);
    } catch (error) {
        next(error);
    }
};

// Update stock quantity
export const updateStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity, operation } = req.body; // operation: 'set', 'add', 'subtract'

        const product = await prisma.product.findUnique({
            where: { id }
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        let newQuantity;
        switch (operation) {
            case 'add':
                newQuantity = product.stockQuantity + quantity;
                break;
            case 'subtract':
                newQuantity = Math.max(0, product.stockQuantity - quantity);
                break;
            case 'set':
            default:
                newQuantity = quantity;
        }

        const updatedProduct = await prisma.product.update({
            where: { id },
            data: { stockQuantity: newQuantity }
        });

        res.json(updatedProduct);
    } catch (error) {
        next(error);
    }
};