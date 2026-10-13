import sharp from 'sharp';
import { ApiError } from '../../infra/errors.js';
export const IMAGE_LIMIT=5*1024*1024;
export async function normalizeProductImage(bytes:Buffer,mime:string){
 const formats:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
 if(!formats[mime]||bytes.length===0)throw new ApiError(400,'INVALID_IMAGE','รองรับ JPG, PNG และ WebP เท่านั้น');
 if(bytes.length>IMAGE_LIMIT)throw new ApiError(413,'IMAGE_TOO_LARGE','รูปต้องไม่เกิน 5MB');
 try{const image=sharp(bytes,{limitInputPixels:16000000}),metadata=await image.metadata();if(metadata.format!==formats[mime]||!metadata.width||!metadata.height||(metadata.pages??1)>1)throw new Error('Invalid raster');
  // Re-encode a bounded raster and strip source EXIF/location metadata.
  return await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
 }catch{throw new ApiError(400,'INVALID_IMAGE','ไฟล์รูปไม่ถูกต้อง รูปต้องไม่เกิน 16 ล้านพิกเซลและเป็นภาพนิ่ง');}
}

export async function createProductThumbnail(normalized:Buffer){
 return sharp(normalized,{limitInputPixels:16000000}).rotate().resize({width:600,height:440,fit:'inside',withoutEnlargement:true}).webp({quality:75}).toBuffer();
}
