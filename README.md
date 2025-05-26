# LibraryLens AI - Intelligent Book Cataloging System

An advanced AI-powered web application for intelligent book cataloging, combining sophisticated metadata management with user-friendly technological innovations.

## 🚀 Quick Start for Replit

### Step 1: Import to Replit
1. Go to [Replit.com](https://replit.com)
2. Click "Create Repl" 
3. Select "Import from GitHub"
4. Enter the repository URL: `https://github.com/Shriti-KL/LIbrary_Lens_AI_client`
5. Select the **test-branch** (important!)
6. Click "Import"

### Step 2: Initial Setup
Once imported, Replit will automatically:
- Install all dependencies
- Set up the PostgreSQL database
- Start the application

### Step 3: Get Your API Keys
You'll need these API keys to use the full functionality:

#### Required API Keys:
1. **OpenAI API Key** (Required)
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key (starts with `sk-...`)

2. **Google Books API Key** (Required)
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the Books API
   - Create credentials → API Key
   - Copy the API key

#### Optional API Keys (for enhanced search):
3. **Google Custom Search Engine Key** (Optional)
   - Go to [Google Custom Search](https://developers.google.com/custom-search/v1/introduction)
   - Create a custom search engine
   - Get your API key and Search Engine ID

### Step 4: Enter API Keys in the Application
1. Open your LibraryLens application in Replit
2. Click "Register" to create an account (or login if you have one)
3. When prompted, enter your API keys in the modal that appears
4. Click "Save API Keys"

### Step 5: Start Using LibraryLens! 🎉
Your LibraryLens application is now ready to use with all features:
- **Book Analysis**: Analyze books by ISBN, cover image, or manual entry
- **Batch Processing**: Upload multiple book covers or process multiple ISBNs
- **Book Archive**: Manage your complete book collection
- **PDF Export**: Generate professional PDF reports

## 🔧 Features

### Core Functionality
- **Multi-source Book Verification**: Combines Google Books, DNB, and OpenAI for accurate metadata
- **AI-Powered Analysis**: Generates summaries, themes, and genre classifications
- **Batch Processing**: Handle multiple books simultaneously
- **Professional PDF Export**: Generate detailed catalog reports
- **Secure API Management**: Session-based API key storage

### Supported Analysis Methods
1. **ISBN Lookup**: Most accurate method using 13-digit or 10-digit ISBNs
2. **Cover Image Analysis**: Upload book cover images for automatic recognition
3. **Manual Entry**: Enter title and author for guided analysis

## 🛡️ Security Features
- **No Hardcoded API Keys**: All API keys are user-provided and session-specific
- **Secure Authentication**: User accounts with session management
- **Data Protection**: Robust input validation and sanitization

## 🔍 How It Works

### Book Analysis Process
1. **Input**: Provide ISBN, cover image, or book details
2. **Verification**: Cross-reference with multiple authoritative sources
3. **AI Enhancement**: Generate additional metadata and analysis
4. **Storage**: Save to your personal library database
5. **Export**: Generate professional PDF reports

### Data Sources
- **Google Books API**: Primary metadata source
- **DNB (German National Library)**: Authoritative cataloging data
- **OpenAI**: AI-generated summaries and analysis

## 📋 System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for API services
- Replit account for hosting

## 🚨 Important Notes
- **API Keys**: Keep your API keys secure and never share them
- **Usage Limits**: Be aware of API usage limits from providers
- **Data Privacy**: All book data is stored securely in your private database

## 🆘 Support
If you encounter any issues:
1. Check that all required API keys are entered correctly
2. Verify your internet connection
3. Try refreshing the application
4. Contact support if problems persist

## 🎯 Perfect for
- **Libraries**: Digital cataloging and collection management
- **Book Collectors**: Personal library organization
- **Educators**: Academic resource management
- **Publishers**: Manuscript and inventory tracking

---

**Built with**: React, TypeScript, Node.js, PostgreSQL, OpenAI, Google Books API

**Ready to revolutionize your book cataloging experience!** 📚✨
