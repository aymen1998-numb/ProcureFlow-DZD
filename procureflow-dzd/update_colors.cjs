const fs = require('fs');
const path = require('path');

function replaceColors(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceColors(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      if (content.includes('#1E3A5F')) {
        content = content.replace(/#1E3A5F/g, '#136AA8'); 
        changed = true;
      }
      if (content.includes('bg-blue-600')) {
        content = content.replace(/bg-blue-600/g, 'bg-[#009CDA]');
        changed = true;
      }
      if (content.includes('text-blue-600')) {
        content = content.replace(/text-blue-600/g, 'text-[#009CDA]');
        changed = true;
      }
      if (content.includes('ring-blue-600')) {
        content = content.replace(/ring-blue-600/g, 'ring-[#009CDA]');
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

replaceColors('./src');
console.log('Colors updated.');
