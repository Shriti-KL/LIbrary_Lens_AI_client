#!/usr/bin/env python3
# Book service that provides enhanced ISBN lookups

import openai
import requests
import re
import json
import logging
import os
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import quote_plus
from typing import Dict, List, Optional, Any, Union

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("book_service.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("book_service")

# Environment variables for API keys
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GOOGLE_BOOKS_API_KEY = os.environ.get("GOOGLE_BOOKS_API_KEY", "")

# Fixed reference date (2023 as a stable reference year)
REFERENCE_YEAR = 2023
# Maximum years into the future for publication dates (0 = current year only, 1 = next year allowed)
MAX_FUTURE_YEARS = 0

def get_google_books_by_isbn(isbn: str) -> Dict:
    """Fetch book data from Google Books API using ISBN"""
    try:
        logger.info(f"Looking up ISBN {isbn} in Google Books API")
        url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
        if GOOGLE_BOOKS_API_KEY:
            url += f"&key={GOOGLE_BOOKS_API_KEY}"
            
        response = requests.get(url)
        response.raise_for_status()  # Raise exception for HTTP errors
        data = response.json()
        
        if data.get("totalItems", 0) == 0:
            logger.warning(f"No book found with ISBN {isbn} in Google Books API")
            return {"error": "No book found with this ISBN"}
            
        book_data = data["items"][0]["volumeInfo"]
        sale_info = data["items"][0].get("saleInfo", {})
        industry_identifiers = book_data.get("industryIdentifiers", [])
        isbn_13 = next((id["identifier"] for id in industry_identifiers if id["type"] == "ISBN_13"), None)
        isbn_10 = next((id["identifier"] for id in industry_identifiers if id["type"] == "ISBN_10"), None)
        
        # Format the ISBN with hyphens if available
        formatted_isbn = isbn_13 or isbn_10
        if formatted_isbn and len(formatted_isbn) == 13:
            # Format for ISBN-13: 978-3-95916-132-9 (standard German format)
            formatted_isbn = re.sub(r'^(\d{3})(\d{1})(\d{5})(\d{3})(\d{1})$', r'\1-\2-\3-\4-\5', formatted_isbn)
        elif formatted_isbn and len(formatted_isbn) == 10:
            # Format for ISBN-10: 3-95916-132-5 (standard German format)
            formatted_isbn = re.sub(r'^(\d{1})(\d{5})(\d{3})(\w{1})$', r'\1-\2-\3-\4', formatted_isbn)
        
        # Extract publication year
        published_year = None
        if published_date := book_data.get("publishedDate"):
            # Extract year from publishedDate (could be YYYY, YYYY-MM, or YYYY-MM-DD)
            year_match = re.match(r'^(\d{4})', published_date)
            if year_match:
                published_year = int(year_match.group(1))
                # Validation: if year is in future, it's likely incorrect
                current_year = datetime.now().year
                if published_year > current_year:
                    logger.warning(f"Future publication year {published_year} detected for ISBN {isbn}, likely incorrect")
                    published_year = None
        
        # Extract price if available
        price = None
        if list_price := sale_info.get("listPrice"):
            amount = list_price.get("amount")
            currency = list_price.get("currencyCode")
            if amount and currency:
                price = f"{amount} {currency}"
        
        # Extract authors and contributor information
        authors = book_data.get("authors", [])
        main_author = authors[0] if authors else ""
        
        # Extract statement of responsibility
        statement_of_responsibility = None
        if authors:
            statement_of_responsibility = ", ".join(authors)
        
        # Extract location from publisher (if in format "Location: Publisher")
        location = None
        publisher = book_data.get("publisher", "")
        if publisher and ":" in publisher:
            parts = publisher.split(":", 1)
            location = parts[0].strip()
            publisher = parts[1].strip()
        
        # Determine binding based on PDF availability or other clues
        binding = None
        if book_data.get("isEbook", False) or "pdf" in book_data.get("accessInfo", {}).get("pdf", {}):
            binding = "E-Book"
        
        # Format dimensions if available (usually not provided directly by Google Books)
        dimensions = None
        if book_data.get("dimensions"):
            dimensions = f"{book_data.get('dimensions').get('height', '')} cm"
        
        # The edition information is typically not provided directly by Google Books
        edition = None
        
        # The result formatted according to our application's schema
        result = {
            "title": book_data.get("title", ""),
            "subtitle": book_data.get("subtitle", ""),
            "author": main_author,
            "statementOfResponsibility": statement_of_responsibility,
            "publisher": publisher,
            "publishedYear": published_year,
            "pageCount": book_data.get("pageCount"),
            "language": book_data.get("language", ""),
            "edition": edition,
            "location": location,
            "dimensions": dimensions,
            "isbn": formatted_isbn or isbn,
            "binding": binding,
            "price": price,
            "summary": book_data.get("description", ""),
            "genres": book_data.get("categories", []),
            "coverImageUrl": book_data.get("imageLinks", {}).get("thumbnail", "")
        }
        
        logger.info(f"Successfully retrieved book data for ISBN {isbn} from Google Books API")
        return result
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching from Google Books API: {str(e)}")
        return {"error": f"Google Books API error: {str(e)}"}
    except (KeyError, IndexError) as e:
        logger.error(f"Error parsing Google Books API response: {str(e)}")
        return {"error": f"Error parsing Google Books data: {str(e)}"}
    except Exception as e:
        logger.error(f"Unexpected error in Google Books lookup: {str(e)}")
        return {"error": f"Unexpected error: {str(e)}"}

def get_dnb_metadata(isbn: str) -> Dict:
    """Fetch book metadata from DNB SRU API"""
    try:
        logger.info(f"Looking up ISBN {isbn} in DNB database")
        
        # DNB SRU API endpoint
        base_url = "https://services.dnb.de/sru/dnb"
        params = {
            "version": "1.1",
            "operation": "searchRetrieve",
            "query": f"isbn={isbn}",
            "recordSchema": "MARC21-xml"
        }
        
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        
        # Parse XML response using ElementTree
        root = ET.fromstring(response.text)
        
        # Define namespace
        ns = {'srw': 'http://www.loc.gov/zing/srw/',
              'marc': 'http://www.loc.gov/MARC21/slim'}
        
        # Check if we got any records
        num_records_elem = root.find('.//srw:numberOfRecords', ns)
        num_records = 0
        if num_records_elem is not None and num_records_elem.text:
            try:
                num_records = int(num_records_elem.text)
            except (ValueError, TypeError):
                logger.error(f"Invalid numberOfRecords format in DNB response for ISBN {isbn}")
        
        if num_records == 0:
            logger.warning(f"No records found in DNB for ISBN {isbn}")
            return {"error": "No records found in DNB database"}
        
        # Find the record
        record = root.find('.//srw:recordData/marc:record', ns)
        if record is None:
            logger.error("No record found in DNB response")
            return {"error": "No record found in DNB response"}
        
        # Extract metadata from MARC21 fields - initialize all as None
        title = None
        subtitle = None
        main_author = None
        publisher = None
        published_year = None
        page_count = None
        language = None
        location = None
        statement_of_responsibility = None
        dimensions = None
        binding = None
        price = None
        
        # Process title and statement of responsibility (MARC field 245)
        title_field = record.find('.//marc:datafield[@tag="245"]', ns)
        if title_field is not None:
            # Title (subfield a)
            title_subfield = title_field.find('./marc:subfield[@code="a"]', ns)
            if title_subfield is not None and title_subfield.text:
                title = title_subfield.text.strip()
                
            # Subtitle (subfield b)
            subtitle_subfield = title_field.find('./marc:subfield[@code="b"]', ns)
            if subtitle_subfield is not None and subtitle_subfield.text:
                subtitle = subtitle_subfield.text.strip()
                
            # Statement of responsibility (subfield c)
            resp_subfield = title_field.find('./marc:subfield[@code="c"]', ns)
            if resp_subfield is not None and resp_subfield.text:
                statement_of_responsibility = resp_subfield.text.strip()
        
        # Process author information (MARC field 100)
        author_field = record.find('.//marc:datafield[@tag="100"]', ns)
        if author_field is not None:
            author_subfield = author_field.find('./marc:subfield[@code="a"]', ns)
            if author_subfield is not None and author_subfield.text:
                main_author = author_subfield.text.strip()
        
        # Process publication information (MARC field 264)
        pub_field = record.find('.//marc:datafield[@tag="264"]', ns)
        if pub_field is not None:
            # Location (subfield a)
            loc_subfield = pub_field.find('./marc:subfield[@code="a"]', ns)
            if loc_subfield is not None and loc_subfield.text:
                location = loc_subfield.text.strip()
                
            # Publisher (subfield b)
            pub_subfield = pub_field.find('./marc:subfield[@code="b"]', ns)
            if pub_subfield is not None and pub_subfield.text:
                publisher = pub_subfield.text.strip()
                
            # Publication year (subfield c)
            year_subfield = pub_field.find('./marc:subfield[@code="c"]', ns)
            if year_subfield is not None and year_subfield.text:
                year_text = year_subfield.text.strip()
                year_match = re.search(r'\d{4}', year_text)
                if year_match:
                    published_year = int(year_match.group(0))
                    
                    # Validate publication year immediately
                    logger.info(f"DNB YEAR CHECK: Year={published_year}, Reference={REFERENCE_YEAR + MAX_FUTURE_YEARS}")
                    if published_year > REFERENCE_YEAR + MAX_FUTURE_YEARS:
                        logger.warning(f"VALIDATION: Future publication year detected in DNB: {published_year} > {REFERENCE_YEAR + MAX_FUTURE_YEARS}. Setting to null.")
                        published_year = None
        
        # Process physical description (MARC field 300)
        physical_field = record.find('.//marc:datafield[@tag="300"]', ns)
        if physical_field is not None:
            # Extent/pages (subfield a)
            extent_subfield = physical_field.find('./marc:subfield[@code="a"]', ns)
            if extent_subfield is not None and extent_subfield.text:
                extent_text = extent_subfield.text.strip()
                pages_match = re.search(r'(\d+)\s*S', extent_text)
                if pages_match:
                    page_count = int(pages_match.group(1))
                    
            # Dimensions (subfield c)
            dim_subfield = physical_field.find('./marc:subfield[@code="c"]', ns)
            if dim_subfield is not None and dim_subfield.text:
                dimensions = dim_subfield.text.strip()
        
        # Process language (MARC field 041)
        lang_field = record.find('.//marc:datafield[@tag="041"]', ns)
        if lang_field is not None:
            lang_subfield = lang_field.find('./marc:subfield[@code="a"]', ns)
            if lang_subfield is not None and lang_subfield.text:
                language = lang_subfield.text.strip()
        
        # Process edition statement (MARC field 250)
        edition_field = record.find('.//marc:datafield[@tag="250"]', ns)
        edition = None
        if edition_field is not None:
            edition_subfield = edition_field.find('./marc:subfield[@code="a"]', ns)
            if edition_subfield is not None and edition_subfield.text:
                edition = edition_subfield.text.strip()
        
        # Format result according to our application's schema
        result = {
            "title": title,
            "subtitle": subtitle,
            "author": main_author,
            "statementOfResponsibility": statement_of_responsibility,
            "publisher": publisher,
            "publishedYear": published_year,
            "pageCount": page_count,
            "language": language,
            "edition": edition,
            "location": location,
            "dimensions": dimensions,
            "isbn": isbn,  # Use the input ISBN
            "binding": binding,
            "price": price,
            # DNB doesn't provide these fields directly:
            "summary": "",
            "genres": [],
            "coverImageUrl": ""
        }
        
        logger.info(f"Successfully retrieved book data for ISBN {isbn} from DNB")
        return result
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching from DNB API: {str(e)}")
        return {"error": f"DNB API error: {str(e)}"}
    except ET.ParseError as e:
        logger.error(f"Error parsing DNB XML response: {str(e)}")
        return {"error": f"Error parsing DNB XML: {str(e)}"}
    except Exception as e:
        logger.error(f"Unexpected error in DNB lookup: {str(e)}")
        return {"error": f"Unexpected error: {str(e)}"}

def get_book_by_isbn(isbn: str) -> Dict:
    """
    Get book information by ISBN from multiple sources
    and merge the results prioritizing reliable data
    """
    # Clean ISBN format for searching
    clean_isbn = re.sub(r'[^0-9X]', '', isbn)
    logger.info(f"Starting book lookup for ISBN: {isbn} (cleaned: {clean_isbn})")
    
    # Initialize an empty result
    merged_result = {"isbn": clean_isbn}
    
    # First try DNB (more authoritative for German books)
    dnb_result = get_dnb_metadata(clean_isbn)
    has_dnb_data = "error" not in dnb_result
    
    if has_dnb_data:
        logger.info(f"Found book in DNB: {dnb_result.get('title')}")
        merged_result.update(dnb_result)
    
    # Then try Google Books (for cover image and summary)
    google_result = get_google_books_by_isbn(clean_isbn)
    has_google_data = "error" not in google_result
    
    # If we have Google Books data
    if has_google_data:
        logger.info(f"Found book in Google Books: {google_result.get('title')}")
        
        # If we don't have DNB data, use Google Books as base
        if not has_dnb_data:
            merged_result.update(google_result)
        else:
            # We have both sources, merge strategically
            # Always take cover image from Google if available
            if google_result.get("coverImageUrl"):
                merged_result["coverImageUrl"] = google_result["coverImageUrl"]
                
            # Always take summary from Google if available
            if google_result.get("summary"):
                merged_result["summary"] = google_result["summary"]
                
            # Always take genres from Google if available
            if google_result.get("genres"):
                merged_result["genres"] = google_result["genres"]
                
            # Use Google Books data to fill in missing fields
            for key, value in google_result.items():
                if key not in merged_result or merged_result[key] is None or merged_result[key] == "":
                    merged_result[key] = value
    
    # Validate the merged result
    # Check for future dates (likely incorrect)
    logger.info(f"VALIDATION CHECK: Year={merged_result.get('publishedYear')}, Reference={REFERENCE_YEAR + MAX_FUTURE_YEARS}")
    if merged_result.get("publishedYear") and isinstance(merged_result["publishedYear"], int) and merged_result["publishedYear"] > REFERENCE_YEAR + MAX_FUTURE_YEARS:
        logger.warning(f"FINAL VALIDATION: Future publication year detected: {merged_result['publishedYear']} > {REFERENCE_YEAR + MAX_FUTURE_YEARS}. Setting to null.")
        merged_result["publishedYear"] = None
    
    # Check for unreasonably large page counts
    if merged_result.get("pageCount") and isinstance(merged_result["pageCount"], int) and merged_result["pageCount"] > 2000:
        logger.warning(f"Unusually high page count detected: {merged_result['pageCount']}")
        merged_result["pageCount"] = None
    
    # Log the result
    if merged_result.get("title"):
        logger.info(f"Successfully processed book data: '{merged_result.get('title')}' by {merged_result.get('author')}")
    else:
        logger.warning(f"Failed to find complete book data for ISBN: {isbn}")
    
    return merged_result

# Command-line interface for testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        isbn = sys.argv[1]
        print(json.dumps(get_book_by_isbn(isbn), indent=2))
    else:
        print("Usage: python book_service.py <isbn>")