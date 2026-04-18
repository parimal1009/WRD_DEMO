/**
 * DOCX Writer Service
 * Inserts text into an existing .docx file using JSZip + raw string splicing.
 *
 * Key design: the field map indices are derived from the same raw XML structure,
 * so tableCells[index] and paragraphs[index] point to the correct nodes.
 * We use DOMParser read-only to find paragraph positions, then splice text
 * directly into the raw XML string to avoid all browser serialization bugs.
 */
import JSZip from 'jszip';

export async function insertTextIntoDocx(originalBuffer, insertions, fieldMap) {
  const jszip = new JSZip();
  const zip = await jszip.loadAsync(originalBuffer);
  const xmlString = await zip.file('word/document.xml').async('text');

  // 1. Parse XML read-only to resolve field positions to global paragraph indices
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const allParagraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
  const allCells = Array.from(xmlDoc.getElementsByTagName('w:tc'));

  // Build injection tasks: each maps a global paragraph index -> text to insert
  const injectionTasks = [];

  for (const [fieldId, textToInsert] of Object.entries(insertions)) {
    if (!textToInsert) continue;

    const fieldMeta = fieldMap[fieldId];
    if (!fieldMeta) continue;
    if (fieldMeta.index < 0) continue; // Unmatched field, skip

    let targetParagraphIndex = -1;

    if (fieldMeta.type === 'table-cell') {
      // For table cells, use the xmlParagraphStart to find the last paragraph in the cell
      if (fieldMeta.xmlParagraphStart !== undefined && fieldMeta.xmlParagraphCount !== undefined) {
        // Target the last paragraph in this cell
        targetParagraphIndex = fieldMeta.xmlParagraphStart + fieldMeta.xmlParagraphCount - 1;
      } else {
        // Fallback: use the cell index to find the cell, then its last paragraph
        const cell = allCells[fieldMeta.index];
        if (cell) {
          const cellParas = cell.getElementsByTagName('w:p');
          if (cellParas.length > 0) {
            const lastPara = cellParas[cellParas.length - 1];
            targetParagraphIndex = allParagraphs.indexOf(lastPara);
          }
        }
      }
    } else {
      // Paragraph type — index IS the global paragraph index
      targetParagraphIndex = fieldMeta.index;
    }

    if (targetParagraphIndex >= 0 && targetParagraphIndex < allParagraphs.length) {
      injectionTasks.push({ pIndex: targetParagraphIndex, textToInsert });
    }
  }

  // 2. Find all </w:p> and self-closing <w:p.../> positions in the raw XML string
  const paragraphEnds = [];
  const regex = /(<\/w:p>|<w:p(?: [^>]*)?\/>)/g;
  let match;
  while ((match = regex.exec(xmlString)) !== null) {
    paragraphEnds.push({
      index: match.index,
      length: match[0].length,
      isSelfClosing: match[0].endsWith('/>')
    });
  }

  // 3. Group tasks by splice position, then apply back-to-front
  const groupedTasks = {};
  for (const task of injectionTasks) {
    const pEnd = paragraphEnds[task.pIndex];
    if (!pEnd) continue;

    // Build the XML run to inject
    const xmlRun = `<w:r><w:rPr><w:b/><w:color w:val="1D4ED8"/></w:rPr><w:t xml:space="preserve"> ${escapeXml(task.textToInsert)}</w:t></w:r>`;

    let splicePos, spliceEndPos, payload;

    if (pEnd.isSelfClosing) {
      // Convert self-closing <w:p .../> to <w:p ...>{run}</w:p>
      splicePos = pEnd.index + pEnd.length - 2;
      spliceEndPos = pEnd.index + pEnd.length;
      payload = `>${xmlRun}</w:p>`;
    } else {
      // Insert run just before </w:p>
      splicePos = pEnd.index;
      spliceEndPos = pEnd.index;
      payload = xmlRun;
    }

    if (!groupedTasks[splicePos]) {
      groupedTasks[splicePos] = { splicePos, spliceEndPos, payload: '' };
    }
    groupedTasks[splicePos].payload += payload;
  }

  // Sort back-to-front so earlier splices don't shift later indices
  const sortedSplices = Object.values(groupedTasks).sort((a, b) => b.splicePos - a.splicePos);

  let outputXml = xmlString;
  for (const splice of sortedSplices) {
    outputXml = outputXml.substring(0, splice.splicePos) + splice.payload + outputXml.substring(splice.spliceEndPos);
  }

  // 4. Repackage into zip — no serialization, no namespace corruption
  zip.file('word/document.xml', outputXml);
  const base64 = await zip.generateAsync({ type: 'base64' });
  return base64;
}

/**
 * Escape special XML characters in user-entered text.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
