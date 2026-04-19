/**
 * DOCX Writer Service
 * Inserts text into an existing .docx file using JSZip + raw string splicing.
 *
 * Architecture:
 * The docxParser mathematically mapped every clickable visual element to a flat 
 * RAW paragraph index (fieldMeta.index). We find all paragraph ends in the raw XML 
 * and splice the user text precisely at that matched paragraph index.
 * No XML serializers used. Zero data corruption.
 */
import JSZip from 'jszip';

/**
 * Insert text into an existing .docx file.
 * @param {ArrayBuffer} originalBuffer - The original .docx file as ArrayBuffer
 * @param {Object} insertions - Map of fieldId -> text to insert
 * @param {Object} fieldMap - Map of fieldId -> { type, index, label }
 * @returns {Promise<string>} Base64-encoded modified .docx file
 */
export async function insertTextIntoDocx(originalBuffer, insertions, fieldMap) {
  if (!originalBuffer) {
    throw new Error('No document buffer provided');
  }
  
  const jszip = new JSZip();
  const zip = await jszip.loadAsync(originalBuffer);
  const docXmlFile = zip.file('word/document.xml');
  
  if (!docXmlFile) {
    throw new Error('Invalid .docx: missing word/document.xml');
  }
  
  const xmlString = await docXmlFile.async('text');

  // Build injection tasks
  const injectionTasks = [];

  for (const [fieldId, textToInsert] of Object.entries(insertions)) {
    if (!textToInsert) continue;

    const fieldMeta = fieldMap[fieldId];
    if (!fieldMeta) continue;
    if (fieldMeta.index === undefined || fieldMeta.index < 0) continue;

    // Both table cells and regular paragraphs now store the exact P index in fieldMeta.index
    injectionTasks.push({ pIndex: fieldMeta.index, textToInsert });
  }

  if (injectionTasks.length === 0) {
    // No insertions to make, return original
    const base64 = await zip.generateAsync({ type: 'base64' });
    return base64;
  }

  // Find all </w:p> and self-closing <w:p.../> positions in the raw XML string
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

  // Group tasks by splice position, then apply back-to-front
  const groupedTasks = {};
  for (const task of injectionTasks) {
    const pEnd = paragraphEnds[task.pIndex];
    if (!pEnd) {
      console.warn(`Writer: paragraph index ${task.pIndex} not found in XML (total: ${paragraphEnds.length})`);
      continue;
    }

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

  // Repackage into zip
  zip.file('word/document.xml', outputXml);
  const base64 = await zip.generateAsync({ type: 'base64' });
  return base64;
}

/**
 * Escape XML special characters to prevent document corruption.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
