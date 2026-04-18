/**
 * DOCX Writer Service
 * Modifies an existing .docx file to insert transcriptions using JSZip.
 * By securely splicing string offsets safely instead of risking native browser XMLSerializer,
 * we strictly preserve EXACT layout structures unconditionally.
 */
import JSZip from 'jszip';

export async function insertTextIntoDocx(originalBuffer, insertions, fieldMap) {
  const jszip = new JSZip();
  const zip = await jszip.loadAsync(originalBuffer);
  const xmlString = await zip.file('word/document.xml').async('text');

  // 1. Utilize DOMParser STRICTLY for reliable read-only path finding, avoiding modifying schema layouts!
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
  const tableCells = Array.from(xmlDoc.getElementsByTagName('w:tc'));
  const matchedNodes = new Set();
  
  // Tasks mapping the global paragraph index to the injected payload text
  const injectionTasks = [];

  for (const [fieldId, textToInsert] of Object.entries(insertions)) {
    if (!textToInsert) continue;

    const fieldMeta = fieldMap[fieldId];
    if (!fieldMeta) continue;
    
    let targetNode = null;

    // Utilize strict architectural mapping. Mammoth's field model extracts global nodes incrementally.
    if (fieldMeta.type === 'table-cell') {
      const cell = tableCells[fieldMeta.index];
      if (cell) {
        const cellParas = cell.getElementsByTagName('w:p');
        if (cellParas.length > 0) targetNode = cellParas[cellParas.length - 1];
      }
    } else {
      // Map directly against the native XML DOM
      const p = paragraphs[fieldMeta.index];
      if (p) targetNode = p;
    }

    if (!targetNode && paragraphs.length > 0) {
      targetNode = paragraphs[paragraphs.length - 1];
    }

    // Correlate the target DOM path cleanly back to its exact offset in the layout depth!
    if (targetNode) {
      const pIndex = paragraphs.indexOf(targetNode);
      if (pIndex !== -1) {
         injectionTasks.push({ pIndex, textToInsert });
      }
    }
  }

  // 2. Scan the identical pristine string algorithmically without utilizing the native XML Serializer 
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

  // 3. Reverse-Sort the payloads explicitly and modify the string via index slicing natively!
  const groupedTasks = {};
  for (const task of injectionTasks) {
      const pMatch = paragraphEnds[task.pIndex];
      // Skip heavily mangled nested fields that evade exact traversal mappings in rare documents
      if (!pMatch) continue; 
      
      const textNodeStr = `<w:r><w:rPr><w:b/><w:color w:val="1D4ED8"/></w:rPr><w:t xml:space="preserve"> ${task.textToInsert}</w:t></w:r>`;
      let replaceStart, replaceEnd, payload;
      
      if (pMatch.isSelfClosing) {
         // Seamlessly inject and wrap empty cell declarations 
         replaceStart = pMatch.index + pMatch.length - 2; 
         replaceEnd = pMatch.index + pMatch.length; 
         payload = `>${textNodeStr}</w:p>`;
      } else {
         // Insert explicitly directly before paragraph closes
         replaceStart = pMatch.index;
         replaceEnd = pMatch.index;
         payload = textNodeStr;
      }
      
      // Combine multiple overlapping inserts directly onto the existing index
      if (!groupedTasks[replaceStart]) {
         groupedTasks[replaceStart] = { replaceStart, replaceEnd, payload: '' };
      }
      groupedTasks[replaceStart].payload += payload;
  }
  
  // Enforce mathematically stable back-to-front array slicing
  const finalSplices = Object.values(groupedTasks).sort((a, b) => b.replaceStart - a.replaceStart);

  let pristineXmlString = xmlString;
  for (const splice of finalSplices) {
      pristineXmlString = pristineXmlString.substring(0, splice.replaceStart) + splice.payload + pristineXmlString.substring(splice.replaceEnd);
  }

  // 4. Repackage the zip archive instantly completely bypassing all browser DOMSerializer algorithms!
  zip.file('word/document.xml', pristineXmlString);
  const base64 = await zip.generateAsync({ type: 'base64' });
  return base64;
}
