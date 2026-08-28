/// <reference types="vite/client" />

declare module '*.PNG' {
  const source: string;
  export default source;
}

declare module '*.png' {
  const source: string;
  export default source;
}