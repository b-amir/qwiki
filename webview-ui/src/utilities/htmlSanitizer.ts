function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  const scripts = div.querySelectorAll("script");
  scripts.forEach((script) => script.remove());
  const events = div.querySelectorAll("*");
  events.forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return div.innerHTML;
}

export function sanitizeForRendering(content: string, allowHtml: boolean = false): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  if (allowHtml) {
    return sanitizeHtml(content);
  }

  return escapeHtml(content);
}
