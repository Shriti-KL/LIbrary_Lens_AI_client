import json
import sys
import os

# Simple test book data
test_book = {
    "isbn": "9783736505780",
    "title": "Test Book",
    "subtitle": "A test subtitle",
    "author": "Test Author",
    "publisher": "Test Publisher",
    "publicationYear": 2025,
    "publicationPlace": "Berlin",
    "pageCount": 100,
    "dimensions": "20 cm",
    "price": "EUR 18.00",
    "language": "de",
    "summary": "This is a test summary for the PDF generation.",
    "review": "• This is a test review for PDF generation."
}

# Save path for testing
output_path = "test_output.pdf"

# Import the PDF generation function from our script
sys.path.append("python_services")
from libLensAI_PDFGen import generate_pdf_from_json

# Convert the book data to JSON
json_data = json.dumps(test_book)

print(f"Testing PDF generation with sample data")

# Generate the PDF
result = generate_pdf_from_json(json_data, output_path)

if result:
    print(f"PDF successfully generated at: {os.path.abspath(result)}")
    print(f"File exists: {os.path.exists(result)}")
    print(f"File size: {os.path.getsize(result)} bytes")
else:
    print("PDF generation failed")