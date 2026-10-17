// Empty and zero are different entry values. Keep native schema validation.
export function numberInputValue(text: string): number | null {
  return text === "" ? null : Number(text);
}
