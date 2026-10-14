// Empty and zero are different entry values. Keep native schema validation.
export function numberInputValue(text){return text===''?null:Number(text);}
