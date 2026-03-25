const fs = require('fs');
const content = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');

let stack = [];
let inStr = false;
let strChar = '';
let inLineComment = false;
let inBlockComment = false;
let inTemplate = false;

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  
  if (inLineComment) {
    if (c === '\n') inLineComment = false;
    continue;
  }
  
  if (inBlockComment) {
    if (c === '*' && content[i+1] === '/') {
      inBlockComment = false;
      i++;
    }
    continue;
  }
  
  if (inStr) {
    if (c === '\\\\') { i++; continue; }
    if (c === strChar) inStr = false;
    continue;
  }
  
  if (inTemplate) {
    if (c === '\\\\') { i++; continue; }
    if (c === '`') inTemplate = false;
    if (c === '$' && content[i+1] === '{') {
      const line = content.substring(0, i).split('\n').length;
      stack.push({ char: '${', line, i });
      i++;
    }
    continue;
  }
  
  if (c === '/' && content[i+1] === '/') {
    inLineComment = true;
    i++;
    continue;
  }
  
  if (c === '/' && content[i+1] === '*') {
    inBlockComment = true;
    i++;
    continue;
  }
  
  if (c === '\'' || c === '"') {
    inStr = true;
    strChar = c;
    continue;
  }
  
  if (c === '`') {
    inTemplate = true;
    continue;
  }
  
  if (c === '{') {
    const line = content.substring(0, i).split('\n').length;
    stack.push({ char: '{', line, i });
  } else if (c === '}') {
    if (stack.length > 0) {
      stack.pop();
    } else {
      const line = content.substring(0, i).split('\n').length;
      console.log('Unexpected } at line ' + line);
    }
  }
}

console.log('Unclosed braces opened at lines:', stack.map(s => s.line));
