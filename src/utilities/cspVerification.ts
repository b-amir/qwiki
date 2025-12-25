import { Webview } from "vscode";
import { getNonce } from "@/utilities/getNonce";

export interface CspVerificationResult {
  hasCsp: boolean;
  hasNonce: boolean;
  scriptNonceUsed: boolean;
  inlineScriptsBlocked: boolean;
  resourceRestrictions: {
    defaultSrc: string;
    styleSrc: string;
    scriptSrc: string;
    imgSrc: string;
    fontSrc: string;
  };
  violations: string[];
}

export function verifyCspInHtml(html: string, expectedNonce?: string): CspVerificationResult {
  const violations: string[] = [];
  const result: CspVerificationResult = {
    hasCsp: false,
    hasNonce: false,
    scriptNonceUsed: false,
    inlineScriptsBlocked: false,
    resourceRestrictions: {
      defaultSrc: "",
      styleSrc: "",
      scriptSrc: "",
      imgSrc: "",
      fontSrc: "",
    },
    violations: [],
  };

  const cspMatch = html.match(
    /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content=["']([^"']+)["']/i,
  );
  if (!cspMatch) {
    violations.push("Missing Content-Security-Policy meta tag");
    return result;
  }

  result.hasCsp = true;
  const cspContent = cspMatch[1] ?? "";

  const directives = parseCspDirectives(cspContent);
  result.resourceRestrictions = {
    defaultSrc: directives["default-src"] || "",
    styleSrc: directives["style-src"] || "",
    scriptSrc: directives["script-src"] || "",
    imgSrc: directives["img-src"] || "",
    fontSrc: directives["font-src"] || "",
  };

  if (directives["script-src"]) {
    const scriptSrc = directives["script-src"];
    if (scriptSrc.includes("'nonce-")) {
      result.hasNonce = true;
      const nonceMatch = scriptSrc.match(/'nonce-([^']+)'/);
      if (nonceMatch && nonceMatch[1]) {
        const nonce = nonceMatch[1];
        if (expectedNonce && nonce === expectedNonce) {
          result.scriptNonceUsed = true;
        } else if (!expectedNonce) {
          result.scriptNonceUsed = true;
        }
      }
    } else if (scriptSrc.includes("'unsafe-inline'")) {
      violations.push("script-src allows unsafe-inline (security risk)");
    }
  } else {
    violations.push("Missing script-src directive in CSP");
  }

  if (directives["default-src"] === "'none'") {
    result.inlineScriptsBlocked = true;
  } else if (!directives["script-src"] || !directives["script-src"].includes("'nonce-")) {
    violations.push("Inline scripts may not be blocked without nonce");
  }

  const inlineScriptMatches = html.match(/<script(?![^>]*nonce=)(?![^>]*src=)[^>]*>/gi);
  if (inlineScriptMatches && inlineScriptMatches.length > 0) {
    violations.push(`Found ${inlineScriptMatches.length} inline script(s) without nonce attribute`);
  }

  const scriptTags = html.match(/<script[^>]*>/gi) || [];
  const scriptTagsWithNonce = html.match(/<script[^>]*nonce=["']([^"']+)["'][^>]*>/gi) || [];
  if (scriptTags.length > 0 && scriptTagsWithNonce.length !== scriptTags.length) {
    violations.push(
      `Not all script tags have nonce attributes (${scriptTagsWithNonce.length}/${scriptTags.length})`,
    );
  }

  result.violations = violations;
  return result;
}

function parseCspDirectives(cspContent: string): Record<string, string> {
  const directives: Record<string, string> = {};
  const directivePattern = /([a-z-]+)\s+([^;]+)/gi;
  let match;

  while ((match = directivePattern.exec(cspContent)) !== null) {
    if (match[1] && match[2]) {
      directives[match[1]] = match[2].trim();
    }
  }

  return directives;
}

export function generateCspTestHtml(webview: Webview, nonce: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
  <title>CSP Test</title>
</head>
<body>
  <div id="test-results"></div>
  <script nonce="${nonce}">
    const results = document.getElementById('test-results');
    results.innerHTML = '<h1>CSP Test Page</h1><p>If you see this, CSP is working correctly.</p>';
    
    try {
      eval('test = 1');
      results.innerHTML += '<p style="color: red;">ERROR: Inline eval() should be blocked!</p>';
    } catch (e) {
      results.innerHTML += '<p style="color: green;">✓ Inline eval() correctly blocked</p>';
    }
  </script>
  
  <script>
    results.innerHTML += '<p style="color: red;">ERROR: Script without nonce should be blocked!</p>';
  </script>
</body>
</html>
  `.trim();
}
