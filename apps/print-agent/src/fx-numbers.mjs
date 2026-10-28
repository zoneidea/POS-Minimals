// Format decimal strings without floating-point conversion or loss of quoted precision.
export function displayNumber(value,minimum=0){const[whole='0',fraction='']=String(value).split('.');const decimals=fraction.replace(/0+$/,'').padEnd(minimum,'0');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(decimals?'.'+decimals:'');}
export function rateNumber(value,code){return displayNumber(value,code==='JPY'?4:2);}
