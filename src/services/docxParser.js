/**
 * DOCX Parser Service
 * Uses mammoth to convert .docx to annotated HTML with clickable field IDs.
 */
import mammoth from 'mammoth';

/**
 * Parse a .docx file buffer into annotated HTML.
 * Each paragraph, table cell, and text element gets a data-field-id attribute.
 * @param {ArrayBuffer} arrayBuffer - The .docx file as ArrayBuffer
 * @returns {Promise<{ html: string, fieldMap: Object }>}
 */
export async function parseDocx(arrayBuffer) {
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }
  );

  let html = result.value;
  const messages = result.messages;

  if (messages.length > 0) {
    console.warn('Mammoth warnings:', messages);
  }

  // Annotate HTML elements with field IDs
  const { annotatedHtml, fieldMap } = annotateHtml(html);

  return {
    html: annotatedHtml,
    fieldMap,
    rawHtml: html,
  };
}

/**
 * Annotate HTML elements with data-field-id attributes for click-to-record.
 */
function annotateHtml(html) {
  const fieldMap = {};
  let fieldIndex = 0;

  // Wrap paragraphs with field IDs
  let annotated = html.replace(/<p(\s|>)/g, (match, after) => {
    const id = `field-p-${fieldIndex++}`;
    fieldMap[id] = { type: 'paragraph', index: fieldIndex - 1, label: `Paragraph ${fieldIndex}` };
    return `<p data-field-id="${id}" class="doc-field"${after}`;
  });

  // Wrap table cells with field IDs
  let cellIndex = 0;
  annotated = annotated.replace(/<td(\s|>)/g, (match, after) => {
    const id = `field-td-${cellIndex++}`;
    fieldMap[id] = { type: 'table-cell', index: cellIndex - 1, label: `Cell ${cellIndex}` };
    return `<td data-field-id="${id}" class="doc-field"${after}`;
  });

  // Wrap list items
  let liIndex = 0;
  annotated = annotated.replace(/<li(\s|>)/g, (match, after) => {
    const id = `field-li-${liIndex++}`;
    fieldMap[id] = { type: 'list-item', index: liIndex - 1, label: `List Item ${liIndex}` };
    return `<li data-field-id="${id}" class="doc-field"${after}`;
  });

  // Extract labels from content for better field identification
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (tempDiv) {
    tempDiv.innerHTML = annotated;
    const fields = tempDiv.querySelectorAll('[data-field-id]');
    fields.forEach((field) => {
      const id = field.getAttribute('data-field-id');
      const text = field.textContent.trim().slice(0, 60);
      if (text && fieldMap[id]) {
        fieldMap[id].label = text || fieldMap[id].label;
      }
    });
    annotated = tempDiv.innerHTML;
  }

  return { annotatedHtml: annotated, fieldMap };
}

/**
 * Convert base64 string to ArrayBuffer.
 */
export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
