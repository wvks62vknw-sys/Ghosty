/** A stylesheet imported by the code arrives as its text (build.mjs: loader '.css' → 'text'); THE LOOK reads tokens.css so. */
declare module '*.css' {
  const text: string;
  export default text;
}
