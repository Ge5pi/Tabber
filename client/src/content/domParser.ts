// Recursive Deep DOM, Shadow DOM & iframe Text Extractor

export function extractVisibleTextFromDOM(root: Node = document.body): string {
  const textBlocks: string[] = [];

  function isElementVisible(el: HTMLElement): boolean {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function traverseNode(node: Node) {
    if (!node) return;

    // 1. Text Node
    if (node.nodeType === Node.TEXT_NODE) {
      const val = node.textContent ? node.textContent.trim() : '';
      if (val.length > 3) {
        textBlocks.push(val);
      }
      return;
    }

    // 2. Element Node
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // Skip script, style, SVG, hidden elements
      const tagName = el.tagName.toUpperCase();
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'META', 'LINK'].includes(tagName)) {
        return;
      }

      if (el instanceof HTMLElement && !isElementVisible(el)) {
        return;
      }

      // Check Shadow DOM root
      if (el.shadowRoot) {
        el.shadowRoot.childNodes.forEach(child => traverseNode(child));
      }

      // Check Accessible iframe
      if (tagName === 'IFRAME') {
        try {
          const iframeEl = el as HTMLIFrameElement;
          if (iframeEl.contentDocument && iframeEl.contentDocument.body) {
            iframeEl.contentDocument.body.childNodes.forEach(child => traverseNode(child));
          }
        } catch {
          // Ignore cross-origin iframe security restrictions
        }
      }

      // Traverse regular child nodes
      el.childNodes.forEach(child => traverseNode(child));
    }
  }

  traverseNode(root);

  // Join unique text fragments
  return Array.from(new Set(textBlocks)).join('\n');
}

// Collect Data URLs of visible Viewport Canvas and Image elements for Local Offscreen OCR
export function getVisibleViewportMediaDataUrls(): string[] {
  const dataUrls: string[] = [];
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  function isInViewport(rect: DOMRect): boolean {
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= viewportHeight &&
      rect.right <= viewportWidth &&
      rect.width > 30 &&
      rect.height > 30
    );
  }

  // 1. Visible Canvas elements
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach((canvas) => {
    if (dataUrls.length >= 3) return;
    try {
      const rect = canvas.getBoundingClientRect();
      if (isInViewport(rect)) {
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl && dataUrl.length > 100) {
          dataUrls.push(dataUrl);
        }
      }
    } catch {
      // Ignore tainted canvas errors
    }
  });

  // 2. Visible Image elements
  const images = document.querySelectorAll('img');
  images.forEach((img) => {
    if (dataUrls.length >= 3) return;
    try {
      const rect = img.getBoundingClientRect();
      if (isInViewport(rect) && img.complete && img.naturalWidth > 50) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.naturalWidth;
        tempCanvas.height = img.naturalHeight;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = tempCanvas.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 100) {
            dataUrls.push(dataUrl);
          }
        }
      }
    } catch {
      // Ignore cross-origin image errors
    }
  });

  return dataUrls;
}
