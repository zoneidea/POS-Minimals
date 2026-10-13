import { useEffect,useMemo,useState,type ReactNode } from 'react';
import { createTheme,ThemeProvider } from '@mui/material/styles';
export function ChartTheme({children}:{children:ReactNode}){
 const [dark,setDark]=useState(false);
 useEffect(()=>{const app=document.querySelector('.app');if(!app)return;const sync=()=>setDark(app.getAttribute('data-theme')==='dark');sync();const observer=new MutationObserver(sync);observer.observe(app,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect();},[]);
 const theme=useMemo(()=>createTheme({palette:{mode:dark?'dark':'light',primary:{main:dark?'#6ca9ff':'#005bea'},background:{paper:dark?'#18263c':'#ffffff'},text:{primary:dark?'#e8efff':'#192748',secondary:dark?'#a4b3ce':'#7785a1'}},typography:{fontFamily:"Inter, 'Noto Sans Thai', Tahoma, sans-serif",fontSize:11},shape:{borderRadius:12}}),[dark]);
 return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
