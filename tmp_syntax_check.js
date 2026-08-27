const fs = require('fs');
const s = fs.readFileSync('app/page.tsx','utf8');
const stack = [];
const pairs = {')':'(',']':'[','}':'{'};
for (let i=0;i<s.length;i++){
  const ch = s[i];
  if ('([{'.includes(ch)) stack.push({ch,i});
  else if (')]}'.includes(ch)){
    const top = stack.pop();
    if (!top || top.ch !== pairs[ch]){
      console.error('Mismatch', ch, 'at', i+1, 'expected', pairs[ch], 'found', top && top.ch, 'pos', i+1);
      process.exit(1);
    }
  }
}
if (stack.length) {
  console.error('Unmatched openings remain:', stack.slice(-10).map(x=>x.ch+'@'+(x.i+1)));
  process.exit(2);
}
console.log('Brackets balanced');
