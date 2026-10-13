import { it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RankedProductsChart } from '../apps/web/src/features/reports/RankedProductsChart';
it('renders accessible real zero-valued graph without inventing bar width',()=>{const html=renderToStaticMarkup(<RankedProductsChart label="สินค้าขายดี" items={[{productId:'1',name:'สินค้า',barcode:'001',quantity:0}]}/>);expect(html).toContain('role="img"');expect(html).toContain('width="0"');expect(html).toContain('จำนวนชิ้นที่ขาย');});
it('keeps graph area for empty and error states',()=>{expect(renderToStaticMarkup(<RankedProductsChart label="สินค้าขายดี" items={[]}/>)).toContain('ไม่มีข้อมูลสินค้าขายดี');expect(renderToStaticMarkup(<RankedProductsChart label="สินค้าขายดี" items={[]} message="ไม่สามารถโหลดข้อมูลได้"/>)).toContain('ไม่สามารถโหลดข้อมูลได้');});
