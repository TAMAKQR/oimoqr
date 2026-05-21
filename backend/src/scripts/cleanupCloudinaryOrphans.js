import 'dotenv/config';
import cloudinary from '../config/cloudinary.js';
import { prisma } from '../config/prisma.js';
import { extractCloudinaryPublicId, deleteCloudinaryAssetByPublicId } from '../utils/cloudinaryAsset.js';

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');
const prefixArg = args.find((arg) => arg.startsWith('--prefix='));
const limitArg = args.find((arg) => arg.startsWith('--limit='));

const PREFIX = prefixArg ? prefixArg.split('=')[1] : (process.env.CLOUDINARY_PREFIX || 'oimoqr/');
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : 0;

const parseJsonArray = (value) => {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
};

const collectPublicIds = (values, usedPublicIds) => {
    for (const value of values) {
        if (typeof value !== 'string') {
            continue;
        }

        const publicId = extractCloudinaryPublicId(value);
        if (publicId) {
            usedPublicIds.add(publicId);
        }
    }
};

const fetchAllResourcesByPrefix = async (prefix) => {
    const resources = [];
    let nextCursor;

    do {
        const page = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'image',
            prefix,
            max_results: 500,
            next_cursor: nextCursor
        });

        resources.push(...(page.resources || []));
        nextCursor = page.next_cursor;
        console.log(`Fetched ${page.resources?.length || 0} resources (total: ${resources.length})`);
    } while (nextCursor);

    return resources;
};

const collectUsedCloudinaryPublicIds = async () => {
    const usedPublicIds = new Set();

    const [
        restaurants,
        restaurantBrands,
        categoryGroups,
        categories,
        dishes,
        modifierOptions,
        modifierTemplateOptions,
        customers
    ] = await Promise.all([
        prisma.restaurant.findMany({ select: { logo: true, banners: true } }),
        prisma.restaurantBrand.findMany({ select: { logo: true } }),
        prisma.categoryGroup.findMany({ select: { image: true } }),
        prisma.category.findMany({ select: { image: true } }),
        prisma.dish.findMany({ select: { image: true } }),
        prisma.modifierOption.findMany({ select: { image: true } }),
        prisma.modifierTemplateOption.findMany({ select: { image: true } }),
        prisma.customer.findMany({ select: { avatar: true } })
    ]);

    collectPublicIds(restaurants.map((restaurant) => restaurant.logo), usedPublicIds);
    for (const restaurant of restaurants) {
        collectPublicIds(parseJsonArray(restaurant.banners), usedPublicIds);
    }

    collectPublicIds(restaurantBrands.map((brand) => brand.logo), usedPublicIds);
    collectPublicIds(categoryGroups.map((group) => group.image), usedPublicIds);
    collectPublicIds(categories.map((category) => category.image), usedPublicIds);
    collectPublicIds(dishes.map((dish) => dish.image), usedPublicIds);
    collectPublicIds(modifierOptions.map((option) => option.image), usedPublicIds);
    collectPublicIds(modifierTemplateOptions.map((option) => option.image), usedPublicIds);
    collectPublicIds(customers.map((customer) => customer.avatar), usedPublicIds);

    return usedPublicIds;
};

const run = async () => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new Error('Missing Cloudinary env vars');
    }

    console.log(`Scanning Cloudinary resources with prefix: ${PREFIX}`);
    console.log(`Mode: ${shouldApply ? 'apply' : 'dry-run'}`);

    const [resources, usedPublicIds] = await Promise.all([
        fetchAllResourcesByPrefix(PREFIX),
        collectUsedCloudinaryPublicIds()
    ]);

    console.log(`Referenced Cloudinary assets in database: ${usedPublicIds.size}`);

    let orphanedResources = resources.filter((resource) => !usedPublicIds.has(resource.public_id));
    if (LIMIT > 0) {
        orphanedResources = orphanedResources.slice(0, LIMIT);
    }

    console.log(`Orphaned assets found: ${orphanedResources.length}`);

    if (orphanedResources.length === 0) {
        return;
    }

    for (const resource of orphanedResources) {
        console.log(`- ${resource.public_id} (${resource.bytes || 0} bytes)`);
    }

    if (!shouldApply) {
        console.log('\nDry run complete. Re-run with --apply to delete orphaned assets.');
        return;
    }

    let deletedCount = 0;
    for (const resource of orphanedResources) {
        const deleted = await deleteCloudinaryAssetByPublicId(resource.public_id);
        if (deleted) {
            deletedCount += 1;
            console.log(`Deleted: ${resource.public_id}`);
        }
    }

    console.log(`\nDeleted orphaned assets: ${deletedCount}/${orphanedResources.length}`);
};

run()
    .catch((error) => {
        console.error('Cleanup failed:', error?.message || error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
