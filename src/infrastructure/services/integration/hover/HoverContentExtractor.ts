export class HoverContentExtractor {
  extractTypeFromHover(content: string): string | null {
    const typeMatch = content.match(/(?:type|Type):\s*([^\n]+)/i);
    if (typeMatch && typeMatch[1]) {
      return typeMatch[1].trim();
    }

    const functionMatch = content.match(/(?:function|fn|method)\s+(\w+)\s*[<(]/);
    if (functionMatch) {
      return "function";
    }

    const classMatch = content.match(/class\s+(\w+)/);
    if (classMatch) {
      return "class";
    }

    return null;
  }

  extractDocumentation(content: string): string | undefined {
    const docMatch = content.match(/(?:@description|@param|@returns?)\s+(.+)/i);
    return docMatch && docMatch[1] ? docMatch[1].trim() : undefined;
  }

  detectAsync(content: string): boolean {
    return /async|Promise|Future/.test(content);
  }

  extractParameters(content: string): Array<{ name: string; type?: string }> | undefined {
    const paramMatches = content.matchAll(/@param\s+(\w+)\s+(.+)/gi);
    const params: Array<{ name: string; type?: string }> = [];
    for (const match of paramMatches) {
      if (match && match[1]) {
        params.push({
          name: match[1],
          type: match[2]?.trim(),
        });
      }
    }
    return params.length > 0 ? params : undefined;
  }

  extractReturnType(content: string): string | undefined {
    const returnMatch = content.match(/(?:@returns?|@return)\s+(.+)/i);
    return returnMatch && returnMatch[1] ? returnMatch[1].trim() : undefined;
  }
}
