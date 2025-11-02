import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDeliveryLocations = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    const locations = await prisma.deliveryLocation.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' }
    });

    res.json(locations);
  } catch (error) {
    next(error);
  }
};

export const createDeliveryLocation = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { name, address, latitude, longitude, whatsapp } = req.body;

    if (!name || !address || latitude === undefined || longitude === undefined || !whatsapp) {
      return res.status(400).json({
        error: 'name, address, latitude, longitude, and whatsapp are required'
      });
    }

    const location = await prisma.deliveryLocation.create({
      data: {
        name,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        whatsapp,
        restaurantId
      }
    });

    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryLocation = async (req, res, next) => {
  try {
    const { restaurantId, locationId } = req.params;
    const { name, address, latitude, longitude, whatsapp } = req.body;

    const location = await prisma.deliveryLocation.updateMany({
      where: { 
        id: locationId,
        restaurantId
      },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(whatsapp && { whatsapp })
      }
    });

    if (location.count === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const updatedLocation = await prisma.deliveryLocation.findUnique({
      where: { id: locationId }
    });

    res.json(updatedLocation);
  } catch (error) {
    next(error);
  }
};

export const deleteDeliveryLocation = async (req, res, next) => {
  try {
    const { restaurantId, locationId } = req.params;

    const location = await prisma.deliveryLocation.deleteMany({
      where: { 
        id: locationId,
        restaurantId
      }
    });

    if (location.count === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
