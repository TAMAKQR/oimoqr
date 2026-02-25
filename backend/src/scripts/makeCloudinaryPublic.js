import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const PREFIX = process.env.CLOUDINARY_PREFIX || 'oimoqr/';
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number(process.env.CLOUDINARY_MAKE_PUBLIC_LIMIT || 0);

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Missing Cloudinary env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  process.exit(1);
}

async function fetchAllByPrefix(prefix) {
  const all = [];
  let nextCursor;

  do {
    const page = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      prefix,
      max_results: 500,
      next_cursor: nextCursor
    });

    all.push(...(page.resources || []));
    nextCursor = page.next_cursor;
    console.log(`Fetched ${page.resources?.length || 0} resources (total: ${all.length})`);
  } while (nextCursor);

  return all;
}

async function makePublic(publicId) {
  await cloudinary.uploader.explicit(publicId, {
    type: 'upload',
    resource_type: 'image',
    access_mode: 'public'
  });
}

async function run() {
  console.log(`Scanning Cloudinary resources with prefix: ${PREFIX}`);
  const resources = await fetchAllByPrefix(PREFIX);

  if (resources.length === 0) {
    console.log('No resources found. Nothing to update.');
    return;
  }

  const target = LIMIT > 0 ? resources.slice(0, LIMIT) : resources;
  console.log(`Resources matched: ${resources.length}. Will process: ${target.length}${DRY_RUN ? ' (dry-run)' : ''}`);

  let updated = 0;
  let failed = 0;

  for (const [index, resource] of target.entries()) {
    const id = resource.public_id;
    const currentAccessMode = resource.access_mode || 'default(public)';
    const currentType = resource.type || 'upload';

    process.stdout.write(`[${index + 1}/${target.length}] ${id} | type=${currentType} access=${currentAccessMode} ... `);

    if (DRY_RUN) {
      console.log('SKIP');
      continue;
    }

    try {
      await makePublic(id);
      updated += 1;
      console.log('OK');
    } catch (error) {
      failed += 1;
      const safeError = error?.error?.message || error?.message || 'unknown error';
      console.log(`FAIL (${safeError})`);
    }
  }

  console.log('\nDone.');
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Dry run: ${DRY_RUN ? 'yes' : 'no'}`);
}

run().catch((error) => {
  const safeError = error?.error?.message || error?.message || 'unknown error';
  console.error('Fatal error:', safeError);
  process.exit(1);
});
