const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function processFiles() {
  walkDir(path.join(__dirname, 'src'), (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Remove all dark: prefix utilities
      let newContent = content.replace(/dark:[a-zA-Z0-9_\-\/]+/g, '');
      
      // Clean up extra spaces
      newContent = newContent.replace(/  +/g, ' ');
      
      // Increase contrast of text:
      // text-slate-400 -> text-slate-600
      // text-slate-500 -> text-slate-800
      // text-slate-600 -> text-slate-900
      // text-slate-700 -> text-black
      // text-gray-400 -> text-gray-600
      // text-gray-500 -> text-gray-800
      newContent = newContent
        .replace(/text-slate-400/g, 'text-slate-600')
        .replace(/text-slate-500/g, 'text-slate-800')
        .replace(/text-slate-600/g, 'text-slate-900')
        .replace(/text-slate-700/g, 'text-black')
        .replace(/text-gray-400/g, 'text-gray-600')
        .replace(/text-gray-500/g, 'text-gray-800');
        
      if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('Processed', filePath);
      }
    }
  });
}

processFiles();
