import { PDFDocument, rgb, StandardFonts } from 'pdfkit';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

interface BookData {
    author: string;
    title: string;
    illustrator: string;
    edition: string;
    publisher: string;
    year: string;
    pages: string;
    dimensions: string;
    isbn: string;
    price: string;
    review: string;
    reviewer: string;
    ik: string;
    idb: string;
    asb: string;
    summary: string;
}

async function loadData(jsonFile?: string, csvFile?: string): Promise<BookData[]> {
    const data: BookData[] = [];
    
    if (jsonFile) {
        const jsonContent = await fs.promises.readFile(jsonFile, 'utf-8');
        data.push(...JSON.parse(jsonContent));
    }
    
    if (csvFile) {
        const csvContent = await fs.promises.readFile(csvFile, 'utf-8');
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true
        });
        data.push(...records);
    }
    
    return data;
}

async function renderFixedLayoutPDF(data: BookData[], outputPath: string): Promise<void> {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const width = doc.page.width;
    const height = doc.page.height;
    const margin = 50;
    const gap = 30;
    const colWidth = (width - 2 * margin - gap) / 2;
    const columns = [margin, margin + colWidth + gap];
    const rowHeight = (height - 2 * margin) / 2;
    const rowsPerPage = 2;
    const colsPerPage = 2;
    const itemsPerPage = rowsPerPage * colsPerPage;

    for (let idx = 0; idx < data.length; idx++) {
        const pageItem = idx % itemsPerPage;
        if (pageItem === 0 && idx !== 0) {
            doc.addPage();
        }

        const row = Math.floor(pageItem / 2);
        const col = pageItem % 2;

        const x = columns[col];
        const y = height - margin - row * rowHeight;

        const boxHeight = rowHeight - 10;
        const boxWidth = colWidth;

        // Draw border
        doc.rect(x, y - boxHeight, boxWidth, boxHeight)
           .stroke();

        // Text content
        let textY = y - 10;
        const textX = x + 5;
        const maxWidth = boxWidth - 10;

        const paragraphs = [
            { text: `${data[idx].author}:`, bold: true },
            { text: `${data[idx].title} / ${data[idx].author} ; Illustrationen von ${data[idx].illustrator}.` },
            { text: `- ${data[idx].edition} - ${data[idx].publisher}, ${data[idx].year}.` },
            { text: `${data[idx].pages} : Illustrationen, farbig ; ${data[idx].dimensions}` },
            { text: `ISBN ${data[idx].isbn} Festeinb. : ${data[idx].price}` },
            { text: data[idx].review, italic: true },
            { text: data[idx].reviewer },
            { text: `IK: ${data[idx].ik}` },
            { text: data[idx].idb },
            { text: `ASB: ${data[idx].asb}` },
            { text: `Zusammenfassung: ${data[idx].summary}`, bold: true }
        ];

        for (const p of paragraphs) {
            if (textY - 12 < y - boxHeight + 5) break;

            doc.fontSize(9)
               .font(StandardFonts.TimesRoman)
               .text(p.text, textX, textY, {
                   width: maxWidth,
                   align: 'left',
                   continued: false,
                   bold: p.bold,
                   italic: p.italic
               });
            
            textY -= 12;
        }
    }

    doc.end();
}

async function main() {
    const args = process.argv.slice(2);
    const jsonFile = args.find(arg => arg.startsWith('--json='))?.split('=')[1];
    const csvFile = args.find(arg => arg.startsWith('--csv='))?.split('=')[1];
    const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

    if (!outputFile) {
        console.error('Output file path is required');
        process.exit(1);
    }

    try {
        const data = await loadData(jsonFile, csvFile);
        if (data.length === 0) {
            console.log('No data found in provided input files.');
            return;
        }

        await renderFixedLayoutPDF(data, outputFile);
        console.log(`PDF generated at: ${outputFile}`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
} 