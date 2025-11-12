import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';

export const getRestaurantStaff = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    const staff = await prisma.restaurantStaff.findMany({
      where: { restaurantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            subdomain: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(staff);
  } catch (error) {
    next(error);
  }
};

export const addStaff = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Упрощенная система: все сотрудники - менеджеры (доступ только к меню)
    const finalRole = 'manager';

    // Проверяем, существует ли пользователь
    let user = await prisma.user.findUnique({
      where: { email }
    });

    // Если пользователь не существует - создаем нового (только для менеджера)
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split('@')[0]
          // Менеджер отличается от владельца тем, что у него нет своих ресторанов,
          // но есть записи в RestaurantStaff
        }
      });
    } else {
      // Если пользователь уже существует - проверяем, не добавлен ли он уже
      const existingStaff = await prisma.restaurantStaff.findUnique({
        where: {
          userId_restaurantId: {
            userId: user.id,
            restaurantId
          }
        }
      });

      if (existingStaff) {
        return res.status(400).json({ error: 'User is already a staff member of this restaurant' });
      }
    }

    const staff = await prisma.restaurantStaff.create({
      data: {
        userId: user.id,
        restaurantId,
        role: finalRole
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Staff member added successfully',
      staff
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const { restaurantId, staffId } = req.params;
    const { role, permissions } = req.body;

    if (!role && permissions === undefined) {
      return res.status(400).json({ error: 'At least one field (role or permissions) must be provided' });
    }

    if (role && !['manager', 'staff', 'cashier'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: manager, staff, cashier' });
    }

    const staff = await prisma.restaurantStaff.findUnique({
      where: { id: staffId }
    });

    if (!staff || staff.restaurantId !== restaurantId) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Роль всегда 'manager' - менеджер может работать только с меню
    const updatedStaff = await prisma.restaurantStaff.update({
      where: { id: staffId },
      data: { role: 'manager' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    res.json({
      message: 'Staff member updated successfully',
      staff: updatedStaff
    });
  } catch (error) {
    next(error);
  }
};

export const removeStaff = async (req, res, next) => {
  try {
    const { restaurantId, staffId } = req.params;

    const staff = await prisma.restaurantStaff.findUnique({
      where: { id: staffId }
    });

    if (!staff || staff.restaurantId !== restaurantId) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await prisma.restaurantStaff.delete({
      where: { id: staffId }
    });

    res.json({ message: 'Staff member removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const getStaffPermissions = async (req, res, next) => {
  try {
    const { restaurantId, staffId } = req.params;

    const staff = await prisma.restaurantStaff.findUnique({
      where: { id: staffId }
    });

    if (!staff || staff.restaurantId !== restaurantId) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Менеджеры имеют фиксированные права: управление меню
    const permissions = ['menu', 'dishes', 'categories', 'modifiers'];

    res.json({ permissions });
  } catch (error) {
    next(error);
  }
};

export const updateStaffPermissions = async (req, res, next) => {
  try {
    const { restaurantId, staffId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }

    const staff = await prisma.restaurantStaff.findUnique({
      where: { id: staffId }
    });

    if (!staff || staff.restaurantId !== restaurantId) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Менеджеры имеют фиксированные права - изменять их нельзя
    res.json({
      message: 'Manager permissions are fixed',
      permissions: ['menu', 'dishes', 'categories', 'modifiers']
    });
  } catch (error) {
    next(error);
  }
};
