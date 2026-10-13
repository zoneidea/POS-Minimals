import { expect,it } from 'vitest';
import sharp from 'sharp';
import { normalizeProductImage,IMAGE_LIMIT } from '../apps/api/src/modules/products/image';
it('decodes raster bytes and normalizes private metadata-free WebP',async()=>{const input=await sharp({create:{width:32,height:24,channels:3,background:'#123456'}}).png().toBuffer();const output=await normalizeProductImage(input,'image/png'),metadata=await sharp(output).metadata();expect(metadata).toMatchObject({format:'webp',width:32,height:24});expect(metadata.exif).toBeUndefined();});
it('rejects malformed bytes, mismatched types, SVG and oversized input',async()=>{await expect(normalizeProductImage(Buffer.from('not an image'),'image/png')).rejects.toMatchObject({status:400});const png=await sharp({create:{width:1,height:1,channels:3,background:'#fff'}}).png().toBuffer();await expect(normalizeProductImage(png,'image/jpeg')).rejects.toMatchObject({status:400});await expect(normalizeProductImage(Buffer.from('<svg/>'),'image/svg+xml')).rejects.toMatchObject({status:400});await expect(normalizeProductImage(Buffer.alloc(IMAGE_LIMIT+1),'image/png')).rejects.toMatchObject({status:413});});
it('creates small metadata-free POS thumbnails while preserving originals and not upscaling',async()=>{
 const {createProductThumbnail}=await import('../apps/api/src/modules/products/image');
 const input=await sharp({create:{width:1600,height:1200,channels:3,background:'#123456'}}).png().toBuffer();
 const original=await normalizeProductImage(input,'image/png'),thumb=await createProductThumbnail(original);
 expect(await sharp(original).metadata()).toMatchObject({width:1600,height:1200});
 const meta=await sharp(thumb).metadata();expect(meta.format).toBe('webp');expect(meta.width).toBeLessThanOrEqual(600);expect(meta.height).toBeLessThanOrEqual(440);expect(meta.exif).toBeUndefined();expect(thumb.length).toBeLessThan(original.length);
 const small=await sharp({create:{width:20,height:10,channels:3,background:'#fff'}}).webp().toBuffer();expect(await sharp(await createProductThumbnail(small)).metadata()).toMatchObject({width:20,height:10});
});
