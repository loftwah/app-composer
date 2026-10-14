import {Input} from '@cloudflare/kumo';
import {numberInputValue} from './number-input.mjs';
type Props={value:unknown;onChange:(value:number|null)=>void;label:string;id:string;required:boolean;validation?:{min?:number;max?:number}};
function IntegerField({value,onChange,label,id,required,validation}:Props){
 const min=validation?.min,max=validation?.max;
 const hint=min!==undefined&&max!==undefined?`Between ${min} and ${max}`:min!==undefined?`At least ${min}`:max!==undefined?`At most ${max}`:undefined;
 const invalid=typeof value==='number'&&((min!==undefined&&value<min)||(max!==undefined&&value>max)||!Number.isInteger(value));
 return <Input id={id} label={label} type="number" step="1" min={min} max={max} required={required} value={typeof value==='number'?value:''} onChange={event=>onChange(numberInputValue(event.target.value))} description={hint} aria-invalid={invalid||undefined} error={invalid?hint:undefined}/>;
}
export const fields={integer:IntegerField};
