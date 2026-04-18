/**
 * DOCX Parser Service
 * Uses mammoth for HTML display AND JSZip to parse raw XML for accurate field mapping.
 * The field map indices are derived from the raw document.xml structure so that
 * docxWriter can splice text into the correct positions without index mismatch.
 */
import mammoth from 'mammoth';
import JSZip from 'jszip';

/**
 * Parse a .docx file buffer into annotated HTML + an XML-aligned field map.
 * @param {ArrayBuffer} arrayBuffer - The .docx file as ArrayBuffer
 * @returns {Promise<{ html: string, fieldMap: Object }>}
 */
export async function parseDocx(arrayBuffer) {
  // 1. Convert to HTML for display using Mammoth
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

  // 2. Build the XML-aligned field map from the raw document.xml
  const xmlFieldMap = await buildXmlFieldMap(arrayBuffer);

  // 3. Annotate the Mammoth HTML for display, linking each clickable element
  //    to the correct XML-based field ID
  const { annotatedHtml, fieldMap } = annotateHtmlWithXmlMap(html, xmlFieldMap);

  return {
    html: annotatedHtml,
    fieldMap,
    rawHtml: html,
  };
}

/**
 * Parse raw document.xml from the docx zip and build a field map
 * with indices that exactly match <w:p> and <w:tc> positions in the XML.
 */
async function buildXmlFieldMap(arrayBuffer) {
  const zip = await new JSZip().loadAsync(arrayBuffer);
  const xmlString = await zip.file('word/document.xml').async('text');

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const fields = [];

  // Extract text content from a node (concatenating all w:t elements)
  function getNodeText(node) {
    const textNodes = node.getElementsByTagName('w:t');
    let text = '';
    for (let i = 0; i < textNodes.length; i++) {
      text += textNodes[i].textContent;
    }
    return text.trim();
  }

  // Walk through the document body's direct children to build the field map
  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) return fields;

  const children = body.childNodes;

  // Global counters that match the raw XML order exactly
  let globalParagraphIndex = 0;
  let globalCellIndex = 0;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType !== 1) continue; // Skip text/comment nodes

    const tag = child.nodeName.toLowerCase();

    if (tag === 'w:p') {
      // Standalone paragraph (not inside a table)
      const text = getNodeText(child);
      fields.push({
        type: 'paragraph',
        xmlIndex: globalParagraphIndex,
        label: text.slice(0, 60) || `Paragraph ${globalParagraphIndex + 1}`,
        text: text,
      });
      globalParagraphIndex++;
    } else if (tag === 'w:tbl') {
      // Table - walk rows and cells
      const rows = child.getElementsByTagName('w:tr');
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].getElementsByTagName('w:tc');
        for (let c = 0; c < cells.length; c++) {
          // Count paragraphs inside this cell (they contribute to global paragraph count)
          const cellParas = cells[c].getElementsByTagName('w:p');
          const cellText = getNodeText(cells[c]);

          fields.push({
            type: 'table-cell',
            xmlIndex: globalCellIndex,
            xmlParagraphStart: globalParagraphIndex,
            xmlParagraphCount: cellParas.length,
            label: cellText.slice(0, 60) || `Cell ${globalCellIndex + 1}`,
            text: cellText,
            row: r,
            col: c,
          });

          globalParagraphIndex += cellParas.length;
          globalCellIndex++;
        }
      }
    } else if (tag === 'w:sectpr') {
      // Section properties — skip but count any inner paragraphs
      const innerP = child.getElementsByTagName('w:p');
      globalParagraphIndex += innerP.length;
    }
  }

  return fields;
}

/**
 * Annotate Mammoth HTML with field IDs linked to the XML field map.
 * We match Mammoth's sequential HTML elements to the XML fields by text content.
 */
function annotateHtmlWithXmlMap(html, xmlFields) {
  const fieldMap = {};

  // Parse the Mammoth HTML into a DOM for manipulation
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!tempDiv) return { annotatedHtml: html, fieldMap };

  tempDiv.innerHTML = html;

  // Collect all paragraphs and table cells from the HTML
  const htmlParagraphs = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  const htmlCells = tempDiv.querySelectorAll('td');

  // Track which XML fields have been matched
  const usedXmlFields = new Set();

  // Helper: normalize text for comparison
  const normalize = (str) => str.replace(/\s+/g, ' ').trim().toLowerCase();

  // Match HTML table cells to XML table cells by text content
  htmlCells.forEach((cell) => {
    const htmlText = normalize(cell.textContent);

    // Find the best matching XML cell field
    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < xmlFields.length; i++) {
      if (usedXmlFields.has(i)) continue;
      if (xmlFields[i].type !== 'table-cell') continue;

      const xmlText = normalize(xmlFields[i].text);

      // Score: exact match > contains > partial
      let score = 0;
      if (htmlText === xmlText) {
        score = 100;
      } else if (htmlText && xmlText && htmlText.includes(xmlText)) {
        score = 70;
      } else if (htmlText && xmlText && xmlText.includes(htmlText)) {
        score = 60;
      } else if (htmlText === '' && xmlText === '') {
        score = 30; // Both empty — match sequentially
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = i;
      }
    }

    if (bestMatch !== null && bestScore > 0) {
      const xmlField = xmlFields[bestMatch];
      const id = `field-td-${xmlField.xmlIndex}`;
      usedXmlFields.add(bestMatch);

      fieldMap[id] = {
        type: 'table-cell',
        index: xmlField.xmlIndex,
        label: xmlField.label,
        xmlParagraphStart: xmlField.xmlParagraphStart,
        xmlParagraphCount: xmlField.xmlParagraphCount,
      };

      cell.setAttribute('data-field-id', id);
      cell.classList.add('doc-field');
    } else {
      // Fallback: assign a unique unmatched ID, won't write anything
      const fallbackIndex = xmlFields.length + htmlCells.length;
      const id = `field-td-unmatched-${Math.random().toString(36).slice(2, 8)}`;
      fieldMap[id] = { type: 'table-cell', index: -1, label: cell.textContent.trim().slice(0, 60) || 'Cell' };
      cell.setAttribute('data-field-id', id);
      cell.classList.add('doc-field');
    }
  });

  // Match HTML paragraphs to XML paragraphs
  const xmlParaFields = xmlFields.filter(f => f.type === 'paragraph');
  let paraMatchIndex = 0;

  htmlParagraphs.forEach((p) => {
    // Skip paragraphs that are inside a td (already handled above)
    if (p.closest('td')) return;

    const htmlText = normalize(p.textContent);

    // Try to match by text content first
    let matchedXmlField = null;
    for (let i = paraMatchIndex; i < xmlParaFields.length; i++) {
      if (usedXmlFields.has(xmlFields.indexOf(xmlParaFields[i]))) continue;
      const xmlText = normalize(xmlParaFields[i].text);

      if (htmlText === xmlText || (htmlText && xmlText && (htmlText.includes(xmlText) || xmlText.includes(htmlText)))) {
        matchedXmlField = xmlParaFields[i];
        usedXmlFields.add(xmlFields.indexOf(xmlParaFields[i]));
        paraMatchIndex = i + 1;
        break;
      }
    }

    if (!matchedXmlField && paraMatchIndex < xmlParaFields.length) {
      // Sequential fallback
      matchedXmlField = xmlParaFields[paraMatchIndex];
      usedXmlFields.add(xmlFields.indexOf(matchedXmlField));
      paraMatchIndex++;
    }

    if (matchedXmlField) {
      const id = `field-p-${matchedXmlField.xmlIndex}`;
      fieldMap[id] = {
        type: 'paragraph',
        index: matchedXmlField.xmlIndex,
        label: matchedXmlField.label,
      };
      p.setAttribute('data-field-id', id);
      p.classList.add('doc-field');
    }
  });

  return { annotatedHtml: tempDiv.innerHTML, fieldMap };
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
