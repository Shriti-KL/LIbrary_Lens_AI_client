import argparse
import json
import tempfile
import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.colors import black
from reportlab.platypus import Frame, Paragraph, KeepInFrame


def load_data(json_string):
    """Load book data from a JSON string"""
    try:
        # Parse the JSON string into Python object
        return json.loads(json_string)
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        return None

# Enhanced styles for better text wrapping and handling long words
styles = getSampleStyleSheet()
body_style = ParagraphStyle(
    'body',
    fontName="Times-Roman",
    fontSize=9,
    leading=12,
    alignment=TA_LEFT,
    firstLineIndent=0,
    leftIndent=0,
    rightIndent=0,
    wordWrap='CJK', # Better handling of long words
    allowWidows=0,  # Prevent single lines at bottom of paragraph
    allowOrphans=0, # Prevent single lines at top of paragraph
    splitLongWords=1 # Allow long words to break across lines
)
summary_style = ParagraphStyle(
    'summary',
    fontName="Times-Roman",
    fontSize=9,
    leading=12,
    alignment=TA_LEFT,
    spaceBefore=6,
    spaceAfter=6,
    firstLineIndent=0,
    leftIndent=0,
    rightIndent=0,
    wordWrap='CJK', # Better handling of long words
    allowWidows=0,  # Prevent single lines at bottom of paragraph
    allowOrphans=0, # Prevent single lines at top of paragraph
    splitLongWords=1 # Allow long words to break across lines
)

# Fixed height box rendering function
def render_fixed_layout_pdf(book_data, output_path):
    """Render a PDF with book data in a fixed layout"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    # Position for the main content box
    x = margin
    y = height - margin
    box_height = height - 2 * margin
    box_width = width - 2 * margin

    # Draw black border box around the content
    c.setStrokeColor(black)
    c.rect(x, y - box_height, box_width, box_height, stroke=1, fill=0)

    # Text content positioning
    content_y = y - 10
    text_x = x + 5
    max_width = box_width - 10
    text_y = content_y
    
    # Map fields from the database schema to the expected fields in the PDF
    # Using fallbacks for missing fields
    author = book_data.get('author') or book_data.get('mainAuthor') or "Unbekannt"
    title = book_data.get('title') or ""
    subtitle = book_data.get('subtitle') or ""
    if subtitle:
        title = f"{title} : {subtitle}"
    
    illustrator = book_data.get('illustrator') or ""
    illustrations_info = book_data.get('illustrations') or ""
    
    # Handle author statement or additional authors
    statement_of_responsibility = book_data.get('statementOfResponsibility') or ""
    if not statement_of_responsibility and author:
        statement_of_responsibility = author
        if book_data.get('additionalAuthors') and isinstance(book_data.get('additionalAuthors'), list):
            additional_authors = ', '.join(book_data.get('additionalAuthors'))
            if additional_authors:
                statement_of_responsibility += f", {additional_authors}"
    
    # Edition, publisher and publication info
    edition = book_data.get('edition') or "1. Auflage"
    publisher = book_data.get('publisher') or ""
    year = book_data.get('publicationYear') or ""
    publication_place = book_data.get('publicationPlace') or ""
    
    # Physical details
    pages = ""
    if book_data.get('pageCount'):
        pages = f"{book_data.get('pageCount')} Seiten"
    
    dimensions = book_data.get('dimensions') or ""
    
    # Identifiers and pricing
    isbn = book_data.get('isbn') or ""
    binding = book_data.get('binding') or "Festeinb."
    price = book_data.get('price') or ""
    
    # Content
    summary = book_data.get('summary') or ""
    review = book_data.get('review') or ""
    
    # Classification
    reviewer_name = book_data.get('reviewerName') or ""
    interest_category = book_data.get('interestCategory') or ""
    id_b = book_data.get('idBNumber') or ""
    asb = book_data.get('classificationNumber') or ""
    
    # Create the paragraphs with book data
    paragraphs = [
        f"<b>{author}</b>:",
        f"{title} / {statement_of_responsibility}"
    ]
    
    # Add illustrator if available
    if illustrator:
        paragraphs.append(f"Illustrationen von {illustrator}.")
    
    # Add publication information
    pub_info = f"- {edition}"
    if publication_place and publisher:
        pub_info += f" - {publication_place} : {publisher}"
    if year:
        pub_info += f", {year}"
    pub_info += "."
    paragraphs.append(pub_info)
    
    # Add physical description
    physical_desc = ""
    if pages:
        physical_desc += f"{pages}"
    if illustrations_info:
        if physical_desc:
            physical_desc += f" : {illustrations_info}"
        else:
            physical_desc += f"{illustrations_info}"
    if dimensions:
        if physical_desc:
            physical_desc += f" ; {dimensions}"
        else:
            physical_desc += f"{dimensions}"
    if physical_desc:
        paragraphs.append(physical_desc)
    
    # Add ISBN and price
    if isbn:
        isbn_line = f"ISBN {isbn}"
        if binding:
            isbn_line += f" {binding}"
        if price:
            isbn_line += f" : {price}"
        paragraphs.append(isbn_line)
    
    # Add review if available
    if review:
        paragraphs.append(f"<i>{review}</i>")
    
    # Add reviewer name
    if reviewer_name:
        paragraphs.append(f"{reviewer_name}")
    
    # Add classification information
    if interest_category:
        paragraphs.append(f"IK: {interest_category}")
    if id_b:
        paragraphs.append(f"{id_b}")
    if asb:
        paragraphs.append(f"ASB: {asb}")
    
    # Add summary
    if summary:
        paragraphs.append(f"<b>Zusammenfassung:</b> {summary}")
    
    # Render each paragraph with proper text wrapping
    for text in paragraphs:
        p = Paragraph(text, summary_style if "Zusammenfassung" in text else body_style)
        w, h = p.wrap(max_width, box_height)
        if text_y - h < y - box_height + 5:
            break  # prevent overflow
        p.drawOn(c, text_x, text_y - h)
        text_y -= h + 2

    c.save()
    return output_path

def generate_pdf_from_json(json_data, output_path=None):
    """Generate a PDF from JSON book data"""
    print(f"[DEBUG] Python PDF Generator: Starting PDF generation")
    
    book_data = load_data(json_data)
    if not book_data:
        print(f"[DEBUG] Python PDF Generator: Failed to load book data from JSON")
        return None
    
    # Print book data for debugging
    print(f"[DEBUG] Python PDF Generator: Book data loaded:")
    print(f"  - Title: {book_data.get('title', 'N/A')}")
    print(f"  - Author: {book_data.get('author', 'N/A')} / {book_data.get('mainAuthor', 'N/A')}")
    print(f"  - ISBN: {book_data.get('isbn', 'N/A')}")
    print(f"  - Publisher: {book_data.get('publisher', 'N/A')}")
    
    # If no output path specified, create a temporary file
    if not output_path:
        fd, output_path = tempfile.mkstemp(suffix='.pdf')
        os.close(fd)
    
    print(f"[DEBUG] Python PDF Generator: Output path: {output_path}")
    
    # Render the PDF
    try:
        render_fixed_layout_pdf(book_data, output_path)
        print(f"[DEBUG] Python PDF Generator: PDF successfully rendered")
        return output_path
    except Exception as e:
        print(f"[DEBUG] Python PDF Generator ERROR: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate bibliographic PDF from JSON data.")
    parser.add_argument("--json", help="JSON string containing book data", required=True)
    parser.add_argument("--output", help="Output PDF file path", default=None)
    args = parser.parse_args()

    output_file = generate_pdf_from_json(args.json, args.output)
    if output_file:
        print(f"PDF generated at: {output_file}")
    else:
        print("Failed to generate PDF")