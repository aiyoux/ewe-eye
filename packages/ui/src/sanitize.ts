import dompurify from 'dompurify';

const SAFE_SVG_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'defs',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'use',
  'title',
  'desc'
].map((name) => name.toLowerCase()));

const SAFE_SVG_ATTRIBUTES = new Set([
  'aria-hidden',
  'aria-label',
  'class',
  'clip-path',
  'clip-rule',
  'clipPathUnits',
  'cx',
  'cy',
  'd',
  'fill',
  'fill-opacity',
  'fill-rule',
  'focusable',
  'gradientUnits',
  'height',
  'href',
  'id',
  'mask',
  'mask-type',
  'offset',
  'opacity',
  'points',
  'preserveAspectRatio',
  'r',
  'role',
  'rx',
  'ry',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'transform',
  'viewBox',
  'width',
  'x',
  'x1',
  'x2',
  'xlink:href',
  'xmlns',
  'xmlns:xlink',
  'y',
  'y1',
  'y2'
].map((name) => name.toLowerCase()));

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, raw: string) => {
    const lower = raw.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    const codePoint = lower.startsWith('#x')
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    if (!Number.isFinite(codePoint)) return entity;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
  });
}

function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizedAttributeValue(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/[\u0000-\u001f\u007f\s]+/g, '')
    .toLowerCase();
}

function isSafeAttributeValue(name: string, value: string): boolean {
  if (/[<>]/.test(value)) return false;

  const normalized = normalizedAttributeValue(value);
  if (
    normalized.includes('javascript:') ||
    normalized.includes('vbscript:') ||
    normalized.includes('data:')
  ) {
    return false;
  }

  if (name === 'href' || name === 'xlink:href') {
    return /^#[A-Za-z_][\w:.-]*$/.test(value);
  }

  if (/\burl\s*\(/i.test(value)) {
    return /^url\(\s*#[A-Za-z_][\w:.-]*\s*\)$/i.test(value);
  }

  return true;
}

function sanitizeSvgTag(tag: string): string {
  const closing = tag.match(/^<\s*\/\s*([A-Za-z][\w:-]*)\s*>$/);
  if (closing) {
    const name = closing[1].toLowerCase();
    return SAFE_SVG_ELEMENTS.has(name) ? `</${closing[1]}>` : '';
  }

  const opening = tag.match(/^<\s*([A-Za-z][\w:-]*)([\s\S]*?)\/?\s*>$/);
  if (!opening) return '';

  const name = opening[1].toLowerCase();
  if (!SAFE_SVG_ELEMENTS.has(name)) return '';
  const elementName = opening[1];

  const attrs: string[] = [];
  const attrSource = opening[2];
  const attrPattern = /([A-Za-z_:][A-Za-z0-9:_.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of attrSource.matchAll(attrPattern)) {
    const rawName = match[1];
    const attrName = rawName.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];

    if (!SAFE_SVG_ATTRIBUTES.has(attrName) || attrName.startsWith('on') || value === undefined) {
      continue;
    }
    if (!isSafeAttributeValue(attrName, value)) continue;

    attrs.push(`${rawName}="${escapeAttributeValue(value)}"`);
  }

  const attrText = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  const selfClosing = /\/\s*>$/.test(tag);
  return `<${elementName}${attrText}${selfClosing ? ' /' : ''}>`;
}

function sanitizeSvgForSsr(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<[^>]*>/g, sanitizeSvgTag);
}

export function sanitizeSvg(svg: string | undefined | null): string {
  if (!svg) return '';
  if (typeof window !== 'undefined') {
    return dompurify(window).sanitize(svg, { USE_PROFILES: { svg: true } });
  }
  return sanitizeSvgForSsr(svg);
}
