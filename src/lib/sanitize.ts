// TipTap이 저장하는 HTML을 DB에 넣기 전 sanitize.
// ProseMirror가 편집 중에는 안전한 subset만 허용하지만,
// 누군가 REST로 직접 knowledge_items에 <script>나 onerror attr을 찔러넣으면
// 다음에 에디터로 불러올 때 위험. 입력/출력 양쪽에서 방어.

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "hr",
  "a", "img",
  "table", "thead", "tbody", "tr", "td", "th",
  "span", "div",
];

const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "colspan", "rowspan",
  "style", "class",
  "data-*",
];

/** TipTap/리치 에디터가 생성한 HTML을 안전하게 정리. */
export function sanitizeRichHTML(html: string): string {
  if (!html) return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: [
      "onerror", "onload", "onclick", "onmouseover", "onfocus",
      "onblur", "onchange", "onsubmit",
    ],
    // http/https/data/mailto만 허용 (javascript: 차단)
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}
