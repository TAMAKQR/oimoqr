export const hasRestaurantOwnerAccess = (req, restaurantId) => {
    if (!req?.user || !restaurantId) return false;
    if (req.user.isAdmin) return true;
    return req.user.restaurants?.some((restaurant) => restaurant.id === restaurantId) || false;
};

export const hasRestaurantStaffAccess = (req, restaurantId) => {
    if (!req?.user || !restaurantId) return false;
    return req.user.restaurantStaff?.some((staff) => staff.restaurantId === restaurantId) || false;
};

export const hasRestaurantAccess = (req, restaurantId, { allowStaff = true } = {}) => {
    if (hasRestaurantOwnerAccess(req, restaurantId)) {
        return true;
    }

    if (!allowStaff) {
        return false;
    }

    return hasRestaurantStaffAccess(req, restaurantId);
};

export const ensureRestaurantAccess = (req, res, restaurantId, options = {}) => {
    if (hasRestaurantAccess(req, restaurantId, options)) {
        return true;
    }

    res.status(403).json({ error: 'Access denied for this restaurant' });
    return false;
};

export const ensureRestaurantOwnerAccess = (req, res, restaurantId) => {
    if (hasRestaurantOwnerAccess(req, restaurantId)) {
        return true;
    }

    res.status(403).json({ error: 'Only owner can manage this restaurant resource' });
    return false;
};