// Public channel IDs are routing configuration, never authentication or shop identity.
export function resolveLineLiffId(channel:string|undefined,developingId?:string,publishedId?:string):string{
 return channel==='published'
  ? publishedId||'2012103467-h4JHbf2A'
  : developingId||'2012103465-KynjquiS';
}
