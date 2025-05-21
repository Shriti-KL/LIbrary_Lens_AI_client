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

# Import additional fonts for better character support
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import sys

# Use built-in fonts (no registration needed) for better portability
# Standard ReportLab fonts include: 'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
# 'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
# 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Symbol', 'ZapfDingbats'

# Use Times-Roman as primary font with Helvetica as fallback for better character support
primary_font = 'Times-Roman'
bold_font = 'Times-Bold'
italic_font = 'Times-Italic'
bold_italic_font = 'Times-BoldItalic'

# Define additional fallback fonts for better character support
sans_font = 'Helvetica'
sans_bold_font = 'Helvetica-Bold'

print(f"Using default built-in fonts: {primary_font} (primary), {sans_font} (fallback)")

# We will use PDF's built-in font substitution capabilities
# This provides better support for international characters than trying to embed fonts

# Define a simple font fallback lookup to handle special characters
font_fallbacks = {
    'primary': [primary_font, sans_font, 'Symbol', 'ZapfDingbats'],
    'bold': [bold_font, sans_bold_font, 'Symbol', 'ZapfDingbats'],
    'italic': [italic_font, 'Helvetica-Oblique', 'Symbol', 'ZapfDingbats']
}

# Character set detection helper
def detect_charset(text):
    """Detect which character set a text likely belongs to"""
    if not text:
        return "latin"
        
    special_chars = 0
    for char in text:
        if ord(char) > 127:  # non-ASCII
            special_chars += 1
            
    # If more than 10% of characters are special, use extended fonts
    if special_chars > len(text) * 0.1:
        return "extended"
    return "latin"

# Enhanced styles with dynamic leading and font fallbacks
styles = getSampleStyleSheet()

# Function to calculate optimal leading based on font size
def calculate_leading(font_size):
    return font_size * 1.5  # 1.5x font size for better line spacing

# Base font size
base_font_size = 9
base_leading = calculate_leading(base_font_size)

# Common style parameters
common_style_params = {
    'fontSize': base_font_size,
    'leading': base_leading,
    'alignment': TA_LEFT,
    'firstLineIndent': 0,
    'leftIndent': 0,
    'rightIndent': 0,
    'wordWrap': 'CJK',        # Better handling of long words and non-Latin characters
    'allowWidows': 0,         # Prevent single lines at bottom of paragraph
    'allowOrphans': 0,        # Prevent single lines at top of paragraph
    'splitLongWords': 1,      # Allow long words to break across lines
    'encoding': 'utf8',       # Explicit encoding for better international text support
    'bulletFontName': primary_font,  # For bullet lists
    'language': None          # Auto-detect language for hyphenation
}

# Create body style
body_style = ParagraphStyle(
    'body',
    fontName=primary_font,
    **common_style_params
)

# Create summary style
summary_style = ParagraphStyle(
    'summary',
    fontName=primary_font,
    spaceBefore=6,
    spaceAfter=6,
    **common_style_params
)

# Create bold style
bold_style = ParagraphStyle(
    'bold',
    fontName=bold_font,
    **common_style_params
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
    # Fix spacing issue in author and title by ensuring no extra spaces
    paragraphs = [
        f"<b>{author.strip()}</b>:",
        f"{title.strip()} / {statement_of_responsibility.strip()}"
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
    
    # Render each paragraph with proper text wrapping and font fallback
    for text in paragraphs:
        # Detect character set to determine if we need font fallbacks
        charset = detect_charset(text)
        
        # Use summary style for summary, body style for others
        style = summary_style if "Zusammenfassung" in text else body_style
        
        # Calculate proper line height based on paragraph content (more space for special characters)
        if charset == "extended":
            # Add 20% more line height for extended character sets
            style.leading = calculate_leading(style.fontSize) * 1.2
        
        # Create paragraph with proper style and wrap according to available width
        p = Paragraph(text, style)
        
        # Enforce maximum width to ensure proper wrapping
        w, h = p.wrap(max_width, box_height)
        
        # Prevent text from flowing outside the box
        if text_y - h < y - box_height + 5:
            print(f"Warning: Text overflow detected, some content may be truncated")
            break  # prevent overflow
            
        # Draw the paragraph with calculated position
        p.drawOn(c, text_x, text_y - h)
        
        # Update position for next paragraph, adding extra space between paragraphs
        padding = 4 if charset == "extended" else 2  # Extra padding for extended character sets
        text_y -= h + padding

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
    parser.add_argument("--json", help="Path to JSON file containing book data", required=True)
    parser.add_argument("--output", help="Output PDF file path", default=None)
    args = parser.parse_args()
    
    # Read the JSON file instead of expecting JSON content directly
    try:
        with open(args.json, 'r', encoding='utf-8') as f:
            json_content = f.read()
            
        output_file = generate_pdf_from_json(json_content, args.output)
        if output_file:
            print(f"PDF generated at: {output_file}")
        else:
            print("Failed to generate PDF")
    except Exception as e:
        print(f"Error processing JSON file: {e}")
        import traceback
        traceback.print_exc()
        print("Failed to generate PDF")