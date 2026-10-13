import {beforeEach,expect,it,vi} from 'vitest';
import sharp from 'sharp';
const mock=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('../apps/api/src/infra/supabase/user-client',()=>({createUserClient:mock.create}));
import {createImageUploadService} from '../apps/api/src/modules/products/image-service';
const id='00000000-0000-4000-8000-000000000001',org='00000000-0000-4000-8000-000000000002',request='00000000-0000-4000-8000-000000000003';
const context={userId:id,orgId:org,orgName:'Shop',username:'Owner',role:'OWNER' as const,permissions:[]};
beforeEach(()=>vi.clearAllMocks());
function backend(){
 const uploads:{path:string;bytes:Buffer}[]=[];
 const upload=vi.fn(async(path:string,bytes:Buffer)=>{uploads.push({path,bytes});return {error:null};});
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{id,row_version:1},error:null})};
 const rpc=vi.fn(async(_name:string,args:any)=>({data:{id,categoryId:null,barcode:'001',name:'Product',salePrice:'10.00',unitCost:'0.00',quantity:5,version:2,imagePath:args.p_path},error:null}));
 mock.create.mockReturnValue({from:()=>query,rpc,storage:{from:()=>({upload,createSignedUrls:async(paths:string[])=>({data:paths.map(path=>({path,signedUrl:'https://storage.test/'+path})),error:null})})}});
 return {uploads,upload,rpc};
}
it('uploads original and thumbnail before one versioned attachment; response retains original path',async()=>{
 const b=backend(),input=await sharp({create:{width:1600,height:1200,channels:3,background:'#123456'}}).png().toBuffer();
 const product=await createImageUploadService('url','key')('upload-test-token',context,id,1,input,'image/png',request);
 expect(b.uploads).toHaveLength(2);expect(b.uploads[0]!.path).not.toBe(b.uploads[1]!.path);
 expect(await sharp(b.uploads[0]!.bytes).metadata()).toMatchObject({width:1600,height:1200});
 const thumb=await sharp(b.uploads[1]!.bytes).metadata();expect(thumb.width).toBeLessThanOrEqual(600);expect(thumb.height).toBeLessThanOrEqual(440);
 expect(b.rpc).toHaveBeenCalledOnce();expect(b.rpc).toHaveBeenCalledWith('set_product_image',{p_id:id,p_path:b.uploads[0]!.path,p_expected_version:1,p_request_id:request,p_thumbnail_path:b.uploads[1]!.path});expect(product.imagePath).toBe(b.uploads[0]!.path);
});
it('does not attach a partial image pair when thumbnail upload fails',async()=>{
 const b=backend();b.upload.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({error:{message:'unavailable'}} as never);
 const input=await sharp({create:{width:20,height:10,channels:3,background:'#fff'}}).png().toBuffer();
 await expect(createImageUploadService('url','key')('failed-upload-token',context,id,1,input,'image/png',request)).rejects.toMatchObject({status:503,code:'IMAGE_UPLOAD_FAILED'});expect(b.rpc).not.toHaveBeenCalled();
});
