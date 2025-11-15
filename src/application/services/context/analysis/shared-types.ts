export interface CodeContext {
  snippet: string;
  language: string;
  filePath: string;
  projectRoot?: string;
  dependencies?: string[];
  imports?: string[];
  exports?: string[];
  functions?: FunctionInfo[];
  classes?: ClassInfo[];
  interfaces?: InterfaceInfo[];
  types?: TypeAliasInfo[];
}

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  visibility: "public" | "private" | "protected";
  decorators?: string[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: any;
  description?: string;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements?: string[];
  properties: PropertyInfo[];
  methods: MethodInfo[];
  constructors?: ConstructorInfo[];
  decorators?: string[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  optional: boolean;
  visibility: "public" | "private" | "protected";
  decorators?: string[];
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  visibility: "public" | "private" | "protected";
  decorators?: string[];
}

export interface ConstructorInfo {
  parameters: ParameterInfo[];
  visibility: "public" | "private" | "protected";
}

export interface InterfaceInfo {
  name: string;
  extends?: string[];
  properties: PropertyInfo[];
  methods: MethodInfo[];
  decorators?: string[];
}

export interface TypeAliasInfo {
  name: string;
  type: string;
  decorators?: string[];
}

export interface ImportInfo {
  module: string;
  elements: string[];
  isExternal: boolean;
  location: {
    line: number;
    column: number;
  };
}

export interface ExportInfo {
  element: string;
  type: "function" | "class" | "interface" | "type" | "const" | "let" | "var";
  location: {
    line: number;
    column: number;
  };
}

export interface CodeStructure {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeAliasInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
}

export interface ComplexityScore {
  overall: number;
  cyclomatic: number;
  cognitive: number;
  halstead: {
    volume: number;
    difficulty: number;
    effort: number;
  };
  lines: number;
  functions: number;
  classes: number;
  interfaces: number;
}
