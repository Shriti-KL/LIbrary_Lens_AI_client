const fs = require('fs');
const storageFile = 'server/storage.ts';

// Read the file
let content = fs.readFileSync(storageFile, 'utf8');

// Find the getBook function and add the secondary_classification field
const pattern = /classification_number as "classificationNumber",\s+additional_classifications as "additionalClassifications",/;
const replacement = 'classification_number as "classificationNumber",\n        secondary_classification as "secondaryClassification",\n        additional_classifications as "additionalClassifications",';

// Replace the pattern in the content
const updatedContent = content.replace(pattern, replacement);

// Write the updated content back to the file
fs.writeFileSync(storageFile, updatedContent);

console.log('Updated storage.ts with secondary_classification field in getBook method');
