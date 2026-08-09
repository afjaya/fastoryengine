// Minimal shims to allow `tsc` to type-check when node_modules are missing
// or when full type packages are not installed. These are intentionally
// small and permissive to avoid blocking compilation; they should be
// replaced by proper `@types/*` packages in a real environment.

declare module '*.css';

declare module 'react' {
  export const StrictMode: any;
  export const Fragment: any;
  export default any;
}

declare module 'react-dom/client' {
  export function createRoot(el: any): { render(node: any): void };
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export const Fragment: any;
}

// Lightweight JSX namespace so the compiler accepts JSX syntax
declare namespace JSX {
  interface IntrinsicAttributes { [key: string]: any }
  interface IntrinsicClassAttributes<T> { [key: string]: any }
  interface IntrinsicElements { [elemName: string]: any }
  interface Element { }
}

// Minimal declaration for the optional @google/genai SDK used at runtime.
// This prevents TypeScript errors when the package is not present locally.
declare module '@google/genai' {
  export interface GenAIOptions { apiKey?: string }
  export interface GenAIResponse { text?: string }
  export class GoogleGenAI {
    constructor(options?: GenAIOptions);
    models: {
      generateContent(args: any): Promise<GenAIResponse>;
    };
  }
  export default GoogleGenAI;
}
