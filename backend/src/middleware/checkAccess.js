import { prisma } from '../config/prisma.js';

/**
 * Middleware to check if a user has access to a restaurant.
 * It checks if the user is an admin, the owner, or a staff member.
 * This is more efficient as it performs a single check.
 */
export const checkRestaurantAccess = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { id: userId, isAdmin } = req.user;

    if (isAdmin) {
      return next();
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        OR: [{ ownerId: userId }, { staff: { some: { userId } } }],
      },
    });

    if (!restaurant) {
      return res.status(403).json({ error: 'Access denied to this restaurant' });
    }

    next();
  } catch (error) {
    next(error);
  }
};