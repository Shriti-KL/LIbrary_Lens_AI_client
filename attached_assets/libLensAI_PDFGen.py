import argparse
import json
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.colors import black
from io import StringIO
from reportlab.platypus import Frame, Paragraph, KeepInFrame


def load_data(json_file, csv_file):
    data = []
    if json_file:
        with open(json_file, 'r', encoding='utf-8') as jf:
            data.extend(json.load(jf))
    if csv_file:
        csv_data = pd.read_csv(csv_file).to_dict(orient='records')
        data.extend(csv_data)
    return data

# Styles
styles = getSampleStyleSheet()
body_style = ParagraphStyle(
    'body',
    fontName="Times-Roman",
    fontSize=9,
    leading=12,
    alignment=TA_LEFT,
)
summary_style = ParagraphStyle(
    'summary',
    fontName="Times-Roman",
    fontSize=9,
    leading=12,
    alignment=TA_LEFT,
    spaceBefore=6,
    spaceAfter=6,
)

# Fixed height box rendering function
def render_fixed_layout_pdf(data, path):
    c = canvas.Canvas(path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    gap = 1 * cm
    col_width = (width - 2 * margin - gap) / 2
    columns = [margin, margin + col_width + gap]
    row_height = (height - 2 * margin) / 2
    rows_per_page = 2
    cols_per_page = 2
    items_per_page = rows_per_page * cols_per_page

    for idx, item in enumerate(data):
        page_item = idx % items_per_page
        if page_item == 0 and idx != 0:
            c.showPage()

        row = page_item // 2
        col = page_item % 2

        x = columns[col]
        y = height - margin - row * row_height

        box_height = row_height - 10
        box_width = col_width

        # Draw black border box
        c.setStrokeColor(black)
        c.rect(x, y - box_height, box_width, box_height, stroke=1, fill=0)

        # Text content
        content_y = y - 10
        text_x = x + 5
        max_width = box_width - 10
        text_y = content_y

        paragraphs = [
            f"<b>{item['author']}</b>:",
            f"{item['title']} / {item['author']} ; Illustrationen von {item['illustrator']}.",
            f"- {item['edition']} - {item['publisher']}, {item['year']}.",
            f"{item['pages']} : Illustrationen, farbig ; {item['dimensions']}",
            f"ISBN {item['isbn']} Festeinb. : {item['price']}",
            f"<i>{item['review']}</i>",
            f"{item['reviewer']}",
            f"IK: {item['ik']}",
            f"{item['idb']}",
            f"ASB: {item['asb']}",
            f"<b>Zusammenfassung:</b> {item['summary']}"
        ]

        for text in paragraphs:
            p = Paragraph(text, summary_style if "Zusammenfassung" in text else body_style)
            w, h = p.wrap(max_width, box_height)
            if text_y - h < y - box_height + 5:
                break  # prevent overflow
            p.drawOn(c, text_x, text_y - h)
            text_y -= h + 2

    c.save()

def main():
    parser = argparse.ArgumentParser(description="Generate bibliographic PDF from JSON/CSV data.")
    parser.add_argument("--json", help="Path to JSON input file", default=None)
    parser.add_argument("--csv", help="Path to CSV input file", default=None)
    parser.add_argument("--output", required=True, help="Output PDF file path")
    args = parser.parse_args()

    data = load_data(args.json, args.csv)
    if not data:
        print("No data found in provided input files.")
        return
#    generate_multi_column_pdf(data, args.output)
#    generate_precise_pdf(data, args.output)
#    generate_refined_pdf(data, args.output)
#    render_pdf_with_summaries(data, args.output)
    render_fixed_layout_pdf(data, args.output)


    print(f"PDF generated at: {args.output}")

if __name__ == "__main__":
    main()
