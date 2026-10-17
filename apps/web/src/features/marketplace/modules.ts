export type MarketplaceModule={
 id:string;
 name:string;
 billingType:'ONE_TIME'|'MONTHLY';
 price:number|null;
 description:string;
 features:readonly string[];
};
export const billingLabels={ONE_TIME:'ซื้อขาด',MONTHLY:'รายเดือน'} as const;
export function modulePrice(module:MarketplaceModule){
 return module.price===null?'รอกำหนดราคา':new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(module.price)+(module.billingType==='MONTHLY'?' / เดือน':'');
}
// UI examples only. These are not published products, prices or entitlements.
export const previewModules:readonly MarketplaceModule[]=[
 {id:'preview-one-time',name:'โมดูลตัวอย่าง 01',billingType:'ONE_TIME',price:null,description:'ตัวอย่างพื้นที่แสดงรายละเอียดโมดูลแบบซื้อขาด ยังไม่ได้กำหนดชื่อ ความสามารถ และราคาขายจริง',features:['แสดงความสามารถและประโยชน์ของโมดูล','แสดงขั้นตอนเริ่มใช้งานและเงื่อนไขที่เกี่ยวข้อง']},
 {id:'preview-monthly',name:'โมดูลตัวอย่าง 02',billingType:'MONTHLY',price:null,description:'ตัวอย่างพื้นที่แสดงรายละเอียดโมดูลแบบรายเดือน ยังไม่ได้กำหนดชื่อ ความสามารถ และราคาขายจริง',features:['แสดงความสามารถและประโยชน์ของโมดูล','แสดงระยะเวลาสิทธิ์และเงื่อนไขการใช้งานรายเดือน']},
];
