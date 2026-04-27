declare module "codemod:ast-grep" {
  export interface AstRootNode {
    findAll(query: unknown): any[];
    commitEdits(edits: Edit[]): unknown;
  }

  export interface AstRoot {
    root(): AstRootNode;
  }

  export interface Edit {
    startPos: number;
    endPos: number;
    insertedText: string;
  }

  export type Codemod<TLang = unknown> = (root: AstRoot) => Promise<unknown> | unknown;
}

declare module "codemod:ast-grep/langs/tsx" {
  interface Tsx {}
  export default Tsx;
}
