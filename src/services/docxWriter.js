/**
 * DOCX Writer Service
 * Modifies an existing .docx file to insert transcriptions using JSZip.
 * By directly editing word/document.xml, we preserve EXACT formatting, tables, and layouts length-for-length!
 */
import JSZip from 'jszip';

/**
 * Insert text into a docx at specified field positions.
 * This reads the original XML and appends text directly into the nodes, preserving everything.
 *
 * @param {ArrayBuffer} originalBuffer - Original .docx file buffer
 * @param {Object} insertions - Map of fieldId -> text to insert
 * @param {Object} fieldMap - Field map from parser with position info
 * @returns {Promise<string>} Modified .docx as base64 string
 */
export async function insertTextIntoDocx(originalBuffer, insertions, fieldMap) {
  // 1. Load the original file directly into a ZIP archive mapper
  const jszip = new JSZip();
  const zip = await jszip.loadAsync(originalBuffer);

  // 2. Extract the core structural XML document
  const xmlString = await zip.file('word/document.xml').async('text');

  // 3. Parse XML using the browser's DOM parser natively
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
  const tableCells = Array.from(xmlDoc.getElementsByTagName('w:tc'));
  const matchedNodes = new Set();

  for (const [fieldId, textToInsert] of Object.entries(insertions)) {
    if (!textToInsert) continue;

    const fieldMeta = fieldMap[fieldId];
    if (!fieldMeta) continue;

    const labelText = fieldMeta.label || '';
    const isSyntheticLabel = labelText.startsWith('Paragraph ') || labelText.startsWith('Cell ') || labelText.startsWith('List Item ');

    // Normalize string to match content inside XML structure accurately
    const normalize = (str) => str.replace(/\s+/g, ' ').trim().substring(0, 45);
    const targetText = normalize(labelText);

    let targetNode = null;

    // 1. If we have real text, Linearly scan for fuzzy matches first
    if (!isSyntheticLabel && targetText.length > 0) {
      const searchPool = fieldMeta.type === 'table-cell' ? tableCells : paragraphs;
      for (const node of searchPool) {
        if (matchedNodes.has(node)) continue;
        const nodeText = normalize(node.textContent);
        if (nodeText && targetText && (nodeText.includes(targetText) || targetText.includes(nodeText))) {
          targetNode = node;
          matchedNodes.add(node);
          break;
        }
      }
    }

    // 2. Fallback: Map by index array exactly if text matching fails or if the cell was originally totally empty
    if (!targetNode) {
      if (fieldMeta.type === 'table-cell') {
        const cell = tableCells[fieldMeta.index];
        if (cell) {
          // Inside a table cell, we must append to its intrinsic <w:p>
          const cellParas = cell.getElementsByTagName('w:p');
          if (cellParas.length > 0) {
            targetNode = cellParas[cellParas.length - 1];
          } else {
            targetNode = cell; // Very rare, but fallback
          }
        }
      } else {
        // Direct paragraph array mapping
        const p = paragraphs[fieldMeta.index];
        if (p) targetNode = p;
      }
    }

    // 3. Absolute Last Fallback: Just attach to end of document
    if (!targetNode && paragraphs.length > 0) {
      targetNode = paragraphs[paragraphs.length - 1];
    }

    if (targetNode) {
      // Create elements without namespace arguments to prevent XMLSerializer from injecting redundant inline `xmlns:w` 
      // attributes which instantly corrupt the DOCX schema parsers in strict versions of Microsoft Word.
      const run = xmlDoc.createElement("w:r");

      const rPr = xmlDoc.createElement("w:rPr");
      const color = xmlDoc.createElement("w:color");
      color.setAttribute("w:val", "1D4ED8");
      const b = xmlDoc.createElement("w:b");

      rPr.appendChild(b);
      rPr.appendChild(color);
      run.appendChild(rPr);

      const t = xmlDoc.createElement("w:t");
      t.setAttribute("xml:space", "preserve");
      t.textContent = ` ${textToInsert}`;
      run.appendChild(t);

      targetNode.appendChild(run);
    }
  }

  // 5. Serialize the patched XML tree right back into a string 
  const serializer = new XMLSerializer();
  let newXmlString = serializer.serializeToString(xmlDoc);

  // Microsoft Word strictly requires the XML prologue. Browser serializers silently strip this during parsing!
  // If we don't prepend it, Word says "Word experienced an error trying to open the file."
  if (!newXmlString.startsWith('<?xml')) {
    newXmlString = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + newXmlString;
  }

  // Clean up any stray root namespaces that might have leaked if the DOM parser messed with them
  newXmlString = newXmlString.replace(/ xmlns:w="http:\/\/schemas\.openxmlformats\.org\/wordprocessingml\/2006\/main"/g, '');

  // 6. Overwrite the file inside the zip memory buffer
  zip.file('word/document.xml', newXmlString);

  // 7. Flush memory stream back directly into the expected Base64 format for the UI IPC handler
  const base64 = await zip.generateAsync({ type: 'base64' });
  return base64;
}

