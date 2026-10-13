import { useEffect,useMemo,useState,type ReactNode } from 'react';
import { createTheme,ThemeProvider } from '@mui/material/styles';
export function ChartTheme({children}:{children:ReactNode}){
 const [dark,setDark]=useState(false);
 useEffect(()=>{const app=document.querySelector('.app');if(!app)return;const sync=()=>setDark(app.getAttribute('data-theme')==='dark');sync();const observer=new MutationObserver(sync);observer.observe(app,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect();},[]);
 const theme=useMemo(()=>createTheme({palette:{mode:dark?'dark':'light',primary:{main:dark?'#a995ff':'#7057f5'},background:{paper:dark?'#141f30':'#ffffff'},text:{primary:dark?'#eef3ff':'#142033',secondary:dark?'#a5b4c9':'#64748b'}},typography:{fontFamily:"Inter, 'Noto Sans Thai', Tahoma, sans-serif",fontSize:11},shape:{borderRadius:12}}),[dark]);
 return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
