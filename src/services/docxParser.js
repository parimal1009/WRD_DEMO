/**
 * DOCX Parser Service  
 * 
 * ARCHITECTURE: "Count-Both-Sides" approach
 * 
 * We parse the raw document.xml with a simple regex to count every <w:p> paragraph
 * in flat sequential order. We also let Mammoth render the HTML. Then we walk the
 * Mammoth HTML DOM counting <td> cells sequentially and match them 1:1 to the
 * raw XML cells (also counted sequentially via <w:tc>). For each cell, we record
 * which raw paragraph indices it contains. 
 * 
 * This avoids any XML modification, any text fuzzy-matching, and any DOM serialization.
 * The mapping is purely structural: cell N in Mammoth's HTML = cell N in raw XML.
 */
import mammoth from 'mammoth';
import JSZip from 'jszip';

export async function parseDocx(arrayBuffer) {
  // 1. Parse raw XML to build structural map (cell -> paragraph indices)
  const structuralMap = await buildStructuralMap(arrayBuffer);

  // 2. Convert to HTML for display using Mammoth (on ORIGINAL unmodified buffer)
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
  if (result.messages.length > 0) {
    console.warn('Mammoth warnings:', result.messages);
  }

  // 3. Annotate HTML by matching sequential structure  
  const { annotatedHtml, fieldMap } = annotateHtml(html, structuralMap);

  return { html: annotatedHtml, fieldMap, rawHtml: html };
}

/**
 * Build a structural map from raw document.xml.
 * Returns arrays of cell info and standalone paragraph info with their
 * global paragraph indices.
 */
async function buildStructuralMap(arrayBuffer) {
  const zip = await new JSZip().loadAsync(arrayBuffer);
  const xmlString = await zip.file('word/document.xml').async('text');

  // We need to walk the XML structure to count:
  // - Global paragraph index (every <w:p> in document order)
  // - Which paragraphs belong to which table cells
  // - Which paragraphs are standalone (outside tables)
  
  const cells = [];        // { cellIndex, firstParagraph, lastParagraph, text }
  const standaloneParagraphs = []; // { paragraphIndex, text }
  
  // Simple state-machine XML walker using regex
  // This avoids DOMParser which can corrupt namespaces
  let globalParagraphIndex = 0;
  let inTable = false;
  let inCell = false;
  let cellParagraphStart = -1;
  let cellIndex = 0;
  let cellTextParts = [];
  
  // Tokenize the XML into structural events
  const tagRegex = /<(\/?)w:(tbl|tr|tc|p|t)([ >\/])/g;
  let match;
  let lastTextEnd = 0;
  
  // More precise approach: use a proper tag-by-tag scanner
  const openClose = /<(\/?)w:(tbl|tr|tc|p)([ \/>][^>]*>|>)/g;
  let tableDepth = 0;
  let cellDepth = 0;
  let paraDepth = 0;
  let currentParaText = '';
  
  // Extract text content between tags
  const getText = (xml, start, end) => {
    const segment = xml.substring(start, end);
    const texts = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(segment)) !== null) {
      texts.push(tMatch[1]);
    }
    return texts.join('');
  };
  
  // Find all structural tags and their positions
  const allTags = [];
  const structRegex = /<(\/?)(w:tbl|w:tr|w:tc|w:p)([ \/>][^>]*>|>)/g;
  let sMatch;
  while ((sMatch = structRegex.exec(xmlString)) !== null) {
    const isClosing = sMatch[1] === '/';
    const tagName = sMatch[2];
    const isSelfClosing = sMatch[0].endsWith('/>');
    allTags.push({
      isClosing,
      tagName,
      isSelfClosing,
      position: sMatch.index,
      endPosition: sMatch.index + sMatch[0].length,
      fullMatch: sMatch[0],
    });
  }
  
  let currentCellStart = -1;
  let paragraphsInCurrentCell = [];
  
  for (let i = 0; i < allTags.length; i++) {
    const tag = allTags[i];
    
    if (tag.tagName === 'w:tbl' && !tag.isClosing && !tag.isSelfClosing) {
      tableDepth++;
    } else if (tag.tagName === 'w:tbl' && tag.isClosing) {
      tableDepth--;
    } else if (tag.tagName === 'w:tc' && !tag.isClosing && !tag.isSelfClosing) {
      cellDepth++;
      if (cellDepth === 1) {
        currentCellStart = tag.endPosition;
        paragraphsInCurrentCell = [];
      }
    } else if (tag.tagName === 'w:tc' && tag.isClosing) {
      if (cellDepth === 1) {
        // Cell is closing — record it
        const cellText = getText(xmlString, currentCellStart, tag.position);
        cells.push({
          cellIndex: cellIndex++,
          paragraphs: [...paragraphsInCurrentCell],
          firstParagraph: paragraphsInCurrentCell.length > 0 ? paragraphsInCurrentCell[0] : -1,
          lastParagraph: paragraphsInCurrentCell.length > 0 ? paragraphsInCurrentCell[paragraphsInCurrentCell.length - 1] : -1,
          text: cellText.trim(),
        });
      }
      cellDepth--;
    } else if (tag.tagName === 'w:p') {
      if (tag.isSelfClosing) {
        // Self-closing paragraph
        if (cellDepth > 0) {
          paragraphsInCurrentCell.push(globalParagraphIndex);
        } else if (tableDepth === 0) {
          standaloneParagraphs.push({
            paragraphIndex: globalParagraphIndex,
            text: '',
          });
        }
        globalParagraphIndex++;
      } else if (!tag.isClosing) {
        // Opening <w:p>
        paraDepth++;
      } else if (tag.isClosing) {
        // Closing </w:p>
        if (paraDepth > 0) {
          // Find the text content of this paragraph by looking back to the opening tag
          // For simplicity, just grab text near this position
          if (cellDepth > 0) {
            paragraphsInCurrentCell.push(globalParagraphIndex);
          } else if (tableDepth === 0) {
            standaloneParagraphs.push({
              paragraphIndex: globalParagraphIndex,
              text: '', // We don't need text for standalone paras
            });
          }
          globalParagraphIndex++;
          paraDepth--;
        }
      }
    }
  }
  
  return { cells, standaloneParagraphs, totalParagraphs: globalParagraphIndex };
}

/**
 * Annotate Mammoth HTML by sequentially matching HTML cells to XML cells.
 * Mammoth preserves table cell order, so cell[0] in HTML = cell[0] in XML.
 */
function annotateHtml(html, structuralMap) {
  const fieldMap = {};
  
  if (typeof document === 'undefined') return { annotatedHtml: html, fieldMap };

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Match HTML cells to XML cells sequentially (1:1 order preserved by Mammoth)
  const htmlCells = tempDiv.querySelectorAll('td');
  
  htmlCells.forEach((td, htmlIndex) => {
    const xmlCell = structuralMap.cells[htmlIndex];
    if (!xmlCell) return;
    
    // Use the LAST paragraph in the cell as the injection target
    const targetParagraph = xmlCell.lastParagraph;
    if (targetParagraph < 0) return;
    
    const fieldId = `field-tc-${htmlIndex}`;
    const label = td.textContent.trim().slice(0, 50) || `Cell ${htmlIndex + 1}`;
    
    fieldMap[fieldId] = {
      type: 'table-cell',
      index: targetParagraph,  // Global paragraph index in raw XML
      label,
    };
    
    td.setAttribute('data-field-id', fieldId);
    td.classList.add('doc-field');
  });

  // Match standalone paragraphs
  const htmlParas = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  let standaloneIndex = 0;
  
  htmlParas.forEach((p) => {
    if (p.closest('td')) return; // Skip table paragraphs
    
    const xmlPara = structuralMap.standaloneParagraphs[standaloneIndex];
    if (!xmlPara) return;
    
    const fieldId = `field-p-${standaloneIndex}`;
    const label = p.textContent.trim().slice(0, 50) || `Paragraph ${standaloneIndex + 1}`;
    
    fieldMap[fieldId] = {
      type: 'paragraph',
      index: xmlPara.paragraphIndex,
      label,
    };
    
    p.setAttribute('data-field-id', fieldId);
    p.classList.add('doc-field');
    standaloneIndex++;
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
