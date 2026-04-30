
const fs = require('fs');
const content = fs.readFileSync('app/actual-dispatch/page.tsx', 'utf8');
let parenBalance = 0;
let braceBalance = 0;
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let char of line) {
        if (char === '(') parenBalance++;
        if (char === ')') parenBalance--;
        if (char === '{') braceBalance++;
        if (char === '}') braceBalance--;
    }
    if (parenBalance < 0 || braceBalance < 0) {
        console.log(`Balance lost at line ${i + 1}: paren=${parenBalance}, brace=${braceBalance}`);
        break;
    }
}
console.log(`Final balance: paren=${parenBalance}, brace=${braceBalance}`);
