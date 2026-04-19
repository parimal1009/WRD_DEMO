/**
 * DOCX Parser Service
 * Uses mammoth for HTML display AND JSZip to parse raw XML for accurate field mapping.
 * 
 * CORE ALGORITHM:
 * To perfectly map Mammoth's transformed HTML elements back to the raw XML coordinates,
 * we inject a unique, invisible tracking ID (V~D_{index}) into EVERY paragraph inside 
 * the XML string *before* handing it to Mammoth. After Mammoth renders the HTML, we extract 
 * the tracking IDs dynamically to link every clickable DIV directly to its exact raw XML paragraph.
 * 
 * This completely eliminates fuzzy text-mapping collisions and empty cell bugs.
 */
import mammoth from 'mammoth';
import JSZip from 'jszip';

export async function parseDocx(arrayBuffer) {
  // 1. Unzip the docx to inject tracking IDs into the raw XML
  const jszip = new JSZip();
  const zip = await jszip.loadAsync(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml');
  
  if (!docXmlFile) {
    throw new Error('Invalid .docx file: missing word/document.xml');
  }
  
  let xmlString = await docXmlFile.async('text');

  // Inject V~D_{index} precisely before every paragraph closes.
  let pCounter = 0;
  let injectedXml = xmlString.replace(/(<\/w:p>|<w:p(?: [^>]*)?\/>)/g, (match) => {
    const signature = `<w:r><w:t>V~D_${pCounter++}</w:t></w:r>`;
    if (match.startsWith('</')) {
      return `${signature}</w:p>`;
    } else {
      // Handle empty self-closing paragraphs by expanding them
      return match.replace(/\/>$/, `>${signature}</w:p>`);
    }
  });

  // Package the injected XML for Mammoth only
  zip.file('word/document.xml', injectedXml);
  const injectedBuffer = await zip.generateAsync({ type: 'arraybuffer' });

  // 2. Convert to HTML for display using Mammoth
  const result = await mammoth.convertToHtml(
    { arrayBuffer: injectedBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }
  );

  let html = result.value;

  // 3. Extract the injected coordinates back out to build a flawless field map
  const { annotatedHtml, fieldMap } = extractCoordinatesAndAnnotate(html);

  return {
    html: annotatedHtml,
    fieldMap,
    // Note: The original buffer in state remains untampered for the Writer!
    rawHtml: html,
  };
}

/**
 * Sweeps the Mammoth HTML to find tracking IDs, annotates the elements,
 * and strips the IDs from the visual layer.
 * 
 * IMPORTANT: Field IDs contain the flat paragraph index which maps directly
 * to the raw XML for the Writer service. This is the critical link.
 */
function extractCoordinatesAndAnnotate(html) {
  const fieldMap = {};
  
  if (typeof document === 'undefined') return { annotatedHtml: html, fieldMap };

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const normalizeLabel = (str) => {
    return str
      .replace(/V~D_\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
  };

  // Strip text nodes of tracking IDs helper
  const eraseTrackingIds = (element) => {
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    while ((textNode = walk.nextNode())) {
      if (textNode.nodeValue.includes('V~D_')) {
        textNode.nodeValue = textNode.nodeValue.replace(/V~D_\d+/g, '');
      }
    }
  };

  // Track which field indices we've already assigned to avoid duplicates
  const usedIndices = new Set();

  // Process all Table Cells first to ensure they become large click targets
  const htmlCells = tempDiv.querySelectorAll('td');
  htmlCells.forEach(td => {
    const rawText = td.textContent;
    const matches = rawText.match(/V~D_(\d+)/g);
    if (matches) {
      // Always target the LAST paragraph in the cell for injection
      const lastIdStr = matches[matches.length - 1];
      const pIndex = parseInt(lastIdStr.split('_')[1], 10);
      
      // Prevent duplicate field assignments
      if (usedIndices.has(pIndex)) return;
      usedIndices.add(pIndex);
      
      const fieldId = `field-tc-${pIndex}`;
      fieldMap[fieldId] = {
        type: 'table-cell',
        index: pIndex, // This is the EXACT flat paragraph index in raw XML!
        label: normalizeLabel(rawText) || 'Table Cell',
      };
      
      td.setAttribute('data-field-id', fieldId);
      td.classList.add('doc-field');
    }
    eraseTrackingIds(td); // Clean cell
  });

  // Process all standalone paragraphs outside of tables
  const htmlParas = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  htmlParas.forEach(p => {
    if (p.closest('td')) return; // Already processed as part of a cell block
    
    const rawText = p.textContent;
    const matches = rawText.match(/V~D_(\d+)/g);
    if (matches) {
      const lastIdStr = matches[matches.length - 1];
      const pIndex = parseInt(lastIdStr.split('_')[1], 10);
      
      // Prevent duplicate field assignments
      if (usedIndices.has(pIndex)) return;
      usedIndices.add(pIndex);
      
      const fieldId = `field-p-${pIndex}`;
      fieldMap[fieldId] = {
        type: 'paragraph',
        index: pIndex, // EXACT flat paragraph index
        label: normalizeLabel(rawText) || 'Paragraph',
      };
      
      p.setAttribute('data-field-id', fieldId);
      p.classList.add('doc-field');
    }
    eraseTrackingIds(p); // Clean paragraph
  });

  // Final redundant cleanup sweep just in case
  eraseTrackingIds(tempDiv);

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
