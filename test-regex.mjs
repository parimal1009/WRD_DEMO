import fs from 'fs';
import { JSDOM } from 'jsdom';

const xmlString = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http..."><w:body>
  <w:p><w:r><w:t>Hello</w:t></w:r></w:p>
  <w:tbl><w:tr><w:tc><w:p><w:t>Table</w:t></w:p></w:tc></w:tr></w:tbl>
  <w:p><w:t>World</w:t></w:p>
</w:body></w:document>`;

const dom = new JSDOM(xmlString, { contentType: "text/xml" });
const paragraphs = Array.from(dom.window.document.getElementsByTagName('w:p'));
const rawParagraphStrings = xmlString.match(/<w:p(\s+[^>]+|>).*?<\/w:p>/gs) || [];

console.log("DOM length: " + paragraphs.length);
console.log("Regex length: " + rawParagraphStrings.length);

for(let i=0; i<paragraphs.length; i++) {
  console.log('DOM['+i+']: ' + paragraphs[i].textContent);
  console.log('REGEX['+i+']: ' + rawParagraphStrings[i]);
}
