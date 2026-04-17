import fs from 'fs';
import { insertTextIntoDocx } from './src/services/docxWriter.js';
import { parseDocx } from './src/services/docxParser.js';

async function test() {
  try {
    const file = fs.readFileSync('public/forms/WR-1_Initial_Needs_Assessment.docx');
    const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    
    // Parse it to get field map for Node.js
    const mammoth = await import('mammoth');
    const result = await mammoth.default.convertToHtml({ buffer: file });
    // Minimal fieldMap logic since parser is DOM based usually
    const fieldMap = {
      'field-p-0': { type: 'paragraph', index: 0, label: 'WR-1' }
    };
    
    // We mock an insertion
    const keys = Object.keys(fieldMap);
    const insertions = {};
    if (keys.length > 0) {
      insertions[keys[0]] = "TEST BOLD INSERT";
    } else {
      console.log('No fields found by parser');
    }
    
    // Write it
    const base64 = await insertTextIntoDocx(arrayBuffer, insertions, fieldMap);
    fs.writeFileSync('test_output.docx', Buffer.from(base64, 'base64'));
    console.log('Test output generated successfully.');
  } catch (err) {
    console.error('Test script failed:', err);
  }
}

test();
