import cloudinary from '../config/cloudinary.js';

const IMAGE_EXTENSION_PATTERN = /\.(jpg|jpeg|png|gif|webp|avif|bmp|tiff|svg)$/i;

const isTransformationSegment = (segment) => segment.includes('_') || segment.includes(',');

export const isCloudinaryUrl = (url) => typeof url === 'string' && url.includes('res.cloudinary.com');

export const extractCloudinaryPublicId = (url) => {
    if (!isCloudinaryUrl(url)) {
        return null;
    }

    try {
        const parsedUrl = new URL(url);
        const uploadMarker = '/upload/';
        const uploadIndex = parsedUrl.pathname.indexOf(uploadMarker);

        if (uploadIndex === -1) {
            return null;
        }

        let pathAfterUpload = parsedUrl.pathname.slice(uploadIndex + uploadMarker.length);
        let segments = pathAfterUpload.split('/').filter(Boolean);

        if (segments.length === 0) {
            return null;
        }

        if (isTransformationSegment(segments[0])) {
            segments = segments.slice(1);
        }

        if (segments[0] && /^v\d+$/.test(segments[0])) {
            segments = segments.slice(1);
        }

        if (segments.length === 0) {
            return null;
        }

        const publicId = segments.join('/').replace(IMAGE_EXTENSION_PATTERN, '');
        return publicId || null;
    } catch {
        return null;
    }
};

export const deleteCloudinaryAssetByUrl = async (url) => {
    const publicId = extractCloudinaryPublicId(url);

    if (!publicId) {
        return false;
    }

    return deleteCloudinaryAssetByPublicId(publicId, url);
};

export const deleteCloudinaryAssetByPublicId = async (publicId, sourceUrl = null) => {
    if (!publicId) {
        return false;
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: 'image',
            type: 'upload',
            invalidate: true
        });

        return result?.result === 'ok' || result?.result === 'not found';
    } catch (error) {
        console.error('Failed to delete Cloudinary asset:', {
            url: sourceUrl,
            publicId,
            message: error?.message || error
        });
        return false;
    }
};