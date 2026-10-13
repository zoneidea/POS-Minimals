import { Analytics,type BeforeSendEvent } from '@vercel/analytics/react';
function pageUrlOnly(event:BeforeSendEvent){
 const url=new URL(event.url);url.search='';url.hash='';
 return {...event,url:url.toString()};
}
export function WebAnalytics(){
 return <Analytics mode={import.meta.env.DEV?'development':'production'} beforeSend={pageUrlOnly}/>;
}
