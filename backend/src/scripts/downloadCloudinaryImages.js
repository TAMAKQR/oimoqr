import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function downloadCloudinaryImages() {
  try {
    console.log('📸 Fetching all images from Cloudinary...');
    
    const resources = [];
    let nextCursor;
    
    do {
      const result = await cloudinary.api.resources({
        max_results: 500,
        next_cursor: nextCursor,
        type: 'upload'
      });
      
      resources.push(...result.resources);
      nextCursor = result.next_cursor;
      
      console.log(`✅ Fetched ${result.resources.length} resources (total: ${resources.length})`);
    } while (nextCursor);
    
    console.log(`\n📊 Total images found: ${resources.length}\n`);
    
    const imageMap = {};
    
    resources.forEach(resource => {
      const publicId = resource.public_id;
      const cloudinaryUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}`;
      imageMap[publicId] = cloudinaryUrl;
      
      console.log(`🖼️  ${publicId}`);
      console.log(`   → ${cloudinaryUrl}\n`);
    });
    
    const outputPath = path.join(process.cwd(), 'src/scripts/cloudinaryImages.json');
    fs.writeFileSync(outputPath, JSON.stringify(imageMap, null, 2));
    
    console.log(`\n✅ Image map saved to: ${outputPath}`);
    console.log(`Total images: ${Object.keys(imageMap).length}`);
    
  } catch (error) {
    console.error('❌ Error fetching images from Cloudinary:', error);
    process.exit(1);
  }
}

downloadCloudinaryImages();
