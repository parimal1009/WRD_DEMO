const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

async function createTemplate(filename, title) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Name: ",
              bold: true,
            }),
            new TextRun({
              text: "____________________",
            }),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Date: ",
              bold: true,
            }),
            new TextRun({
              text: "____________________",
            }),
          ]
        }),
        new Paragraph({
          text: "Notes:",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: "Please provide details here.",
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filename, buffer);
  console.log(`Created ${filename}`);
}

async function main() {
  const dir = path.join(__dirname, '..', 'public', 'forms');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await createTemplate(path.join(dir, 'WR-1_Initial_Needs_Assessment.docx'), 'WR-1 Initial Needs Assessment');
  await createTemplate(path.join(dir, 'WR-10_Risk_Assessment_Staff_Only.docx'), 'WR-10 Risk Assessment (Staff Only)');
  await createTemplate(path.join(dir, 'WR-11_Support_Plan.docx'), 'WR-11 Support Plan');
  await createTemplate(path.join(dir, 'WR-12_Resident_Review_Form.docx'), 'WR-12 Resident Review Form');
}

main().catch(console.error);
