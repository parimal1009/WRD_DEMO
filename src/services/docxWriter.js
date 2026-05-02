/**
 * DOCX Writer Service
 * Inserts text AND images into an existing .docx file using JSZip + raw XML splicing.
 *
 * - Text insertions: splice a <w:r> run before </w:p> at the matched paragraph index.
 * - Image insertions (photos/signatures): embed PNG into the zip, register a
 *   relationship, and inject a <w:drawing> element at the target paragraph.
 */
import JSZip from 'jszip';

/**
 * Insert text/images into an existing .docx file.
 * @param {ArrayBuffer} originalBuffer
 * @param {Object} insertions - fieldId -> text string OR { type, dataUrl, width, height }
 * @param {Object} fieldMap - fieldId -> { type, index, label }
 * @returns {Promise<string>} Base64-encoded modified .docx
 */
export async function insertTextIntoDocx(originalBuffer, insertions, fieldMap) {
  if (!originalBuffer) throw new Error('No document buffer provided');

  const jszip = new JSZip();
  const zip = await jszip.loadAsync(originalBuffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('Invalid .docx: missing word/document.xml');

  const xmlString = await docXmlFile.async('text');

  // ── Relationship management for images ──
  let relsXml = '';
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    relsXml = await relsFile.async('text');
  } else {
    relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  }

  // Find highest existing rId
  let maxRId = 0;
  const ridRegex = /Id="rId(\d+)"/g;
  let ridMatch;
  while ((ridMatch = ridRegex.exec(relsXml)) !== null) {
    maxRId = Math.max(maxRId, parseInt(ridMatch[1], 10));
  }
  let nextRId = maxRId + 1;
  const newRelEntries = [];

  // Build injection tasks
  const injectionTasks = [];

  for (const [fieldId, insertion] of Object.entries(insertions)) {
    if (!insertion) continue;
    const fieldMeta = fieldMap[fieldId];
    if (!fieldMeta || fieldMeta.index === undefined || fieldMeta.index < 0) continue;

    if (typeof insertion === 'object' && insertion.dataUrl) {
      // ── Image / Signature ──
      const rId = `rId${nextRId++}`;
      const imgFile = `media/img_${fieldMeta.index}.png`;
      const b64 = insertion.dataUrl.split(',')[1];
      if (!b64) continue;

      zip.file(`word/${imgFile}`, b64, { base64: true });
      newRelEntries.push(
        `<Relationship Id="${rId}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
        `Target="${imgFile}"/>`
      );

      const cx = (insertion.width || 200) * 9525;
      const cy = (insertion.height || 60) * 9525;
      const dpId = fieldMeta.index + 100;

      const drawXml =
        `<w:r><w:drawing>` +
        `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
        `<wp:extent cx="${cx}" cy="${cy}"/>` +
        `<wp:docPr id="${dpId}" name="Img${dpId}"/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:nvPicPr><pic:cNvPr id="${dpId}" name="Img${dpId}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill>` +
        `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
        `<a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
        `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

      injectionTasks.push({ pIndex: fieldMeta.index, payload: drawXml });
    } else if (typeof insertion === 'string' && insertion) {
      // ── Text ──
      const xmlRun =
        `<w:r><w:rPr><w:b/><w:color w:val="1D4ED8"/></w:rPr>` +
        `<w:t xml:space="preserve"> ${escapeXml(insertion)}</w:t></w:r>`;
      injectionTasks.push({ pIndex: fieldMeta.index, payload: xmlRun });
    }
  }

  if (injectionTasks.length === 0) {
    return await zip.generateAsync({ type: 'base64' });
  }

  // Update rels if images were added
  if (newRelEntries.length > 0) {
    const idx = relsXml.lastIndexOf('</Relationships>');
    relsXml = relsXml.substring(0, idx) + newRelEntries.join('') + relsXml.substring(idx);
    zip.file('word/_rels/document.xml.rels', relsXml);
  }

  // Find all paragraph ends
  const pEnds = [];
  const pRegex = /(<\/w:p>|<w:p(?: [^>]*)?\/>)/g;
  let m;
  while ((m = pRegex.exec(xmlString)) !== null) {
    pEnds.push({ index: m.index, length: m[0].length, selfClose: m[0].endsWith('/>') });
  }

  // Group by splice position
  const grouped = {};
  for (const task of injectionTasks) {
    const pEnd = pEnds[task.pIndex];
    if (!pEnd) { console.warn(`Writer: pIndex ${task.pIndex} not found`); continue; }

    let pos, endPos, content;
    if (pEnd.selfClose) {
      pos = pEnd.index + pEnd.length - 2;
      endPos = pEnd.index + pEnd.length;
      content = `>${task.payload}</w:p>`;
    } else {
      pos = pEnd.index;
      endPos = pEnd.index;
      content = task.payload;
    }

    if (!grouped[pos]) grouped[pos] = { pos, endPos, content: '' };
    grouped[pos].content += content;
  }

  // Apply back-to-front
  const splices = Object.values(grouped).sort((a, b) => b.pos - a.pos);
  let out = xmlString;
  for (const s of splices) {
    out = out.substring(0, s.pos) + s.content + out.substring(s.endPos);
  }

  zip.file('word/document.xml', out);
  return await zip.generateAsync({ type: 'base64' });
}

/**
 * Escape XML special characters.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
