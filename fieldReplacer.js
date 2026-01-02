// fieldReplacer.js
const fs = require('fs');
const path = require('path');

// Field mappings from old to new based on your provided mapping
const fieldMappings = {
  // resources_en (Sheet1.json)
  'zipCodes': 'zip_codes',
  'googleMaps': 'google_maps',
  'statusDate': 'status_date',
  'StatusText': 'status_text',
  'addressZipCode': 'address_zip_code',
  'orgZipNeighborhood': 'org_county_city_zip_neighborhood',
  'daysOfOperation': 'days_of_operation',
  
  // zip_codes (Sheet1.json)
  'zipCode': 'zip_code',
  'neighborhoodLink': 'neighborhood_link',
  'OrgCity': 'org_city',
  'orgCityZipNeighborhood': 'org_county_city_zip_neighborhood',
  
  // registered_organizations (Sheet6.json)
  'registeredOrganization': 'registered_organization',
  'orgEmail': 'org_email',
  'contactPhone': 'org_phone',
  'defaultLanguage': 'org_default_language',
  'orgWebpage': 'org_webpage',
  'orgPassCode': 'org_passcode'
};

// List of file extensions to process
const fileExtensions = ['.js', '.jsx', '.tsx'];

// Directories to exclude
const excludeDirs = ['node_modules', 'build', 'dist', '.git'];

// Function to process a file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // For each field mapping, replace all occurrences
    Object.entries(fieldMappings).forEach(([oldField, newField]) => {
      // Create a regex that matches the field name in different contexts
      // This handles cases like: item.oldField, item['oldField'], {oldField}, oldField:
      const regex = new RegExp(`(\\.|\\[['"]|{|\\s|\\(|,)${oldField}(\\b|\\.|\\[|\\]|['"]|\\s|:|,|\\))`, 'g');
      
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        // Log each replacement
        console.log(`In ${filePath}: Replacing ${oldField} with ${newField} (${matches.length} occurrences)`);
        
        // This replacement preserves the surrounding syntax
        content = content.replace(regex, (match, prefix, suffix) => {
          return `${prefix}${newField}${suffix}`;
        });
        
        modified = true;
      }
    });
    
    // Only write to the file if changes were made
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Function to walk directory recursively
function walkDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory() && !excludeDirs.includes(file)) {
        walkDir(filePath);
      } else if (stats.isFile() && fileExtensions.includes(path.extname(file))) {
        processFile(filePath);
      }
    });
  } catch (error) {
    console.error(`Error processing directory ${dir}:`, error);
  }
}

// Get the target directory from command line arguments
const targetDir = process.argv[2] || './src';
console.log(`Starting field replacement in directory: ${targetDir}`);
walkDir(targetDir);
console.log('Field replacement complete!');