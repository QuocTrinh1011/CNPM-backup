import {useCallback,useEffect,useRef,useState} from 'react';
export function useManagerFilters(defaults){
  const read=()=>{const params=new URLSearchParams(window.location.search);return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,params.get(key)??value]));};
  const [filters,setFilters]=useState(read);
  const current=useRef(filters);
  useEffect(()=>{const update=()=>{current.current=read();setFilters(current.current);};window.addEventListener('popstate',update);window.addEventListener('manager:navigation',update);return()=>{window.removeEventListener('popstate',update);window.removeEventListener('manager:navigation',update);};},[]);
  const change=useCallback(patch=>{const next={...current.current,...patch,...(!Object.hasOwn(patch,'page')?{page:'0'}:{})};const params=new URLSearchParams();for(const [key,value]of Object.entries(next))if(String(value)!==String(defaults[key])&&value!=='')params.set(key,value);const target=window.location.pathname+(params.size?'?'+params:'');if(target!==window.location.pathname+window.location.search)window.history.pushState({},'',target);current.current=next;setFilters(next);},[]);
  return [filters,change];
}
export const managerQuery=params=>{const query=new URLSearchParams();for(const [key,value]of Object.entries(params||{}))if(value!==''&&value!==null&&value!==undefined)query.set(key,String(value));return query.toString();};
export const vietnamDateRange=(from,to)=>{
  const valid=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;};
  return {from:valid(from)?new Date(`${from}T00:00:00+07:00`).toISOString():undefined,to:valid(to)?new Date(Date.parse(`${to}T00:00:00+07:00`)+86400000).toISOString():undefined};
};
