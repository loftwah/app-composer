declare module '@resvg/resvg-wasm/index_bg.wasm?module' {
  const module: WebAssembly.Module;
  export default module;
}

declare module '*.ttf.bin' {
  const buffer: ArrayBuffer;
  export default buffer;
}
