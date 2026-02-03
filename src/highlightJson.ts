export function highlightJson(code: string): string {
  // Tokenize and highlight JSON
  let result = "";
  let i = 0;

  while (i < code.length) {
    const char = code[i];

    // Whitespace
    if (/\s/.test(char)) {
      result += char;
      i++;
      continue;
    }

    // String
    if (char === '"') {
      let str = '"';
      i++;
      while (i < code.length && code[i] !== '"') {
        if (code[i] === "\\" && i + 1 < code.length) {
          str += code[i] + code[i + 1];
          i += 2;
        } else {
          str += code[i];
          i++;
        }
      }
      str += '"';
      i++;

      // Check if it's a key (followed by :)
      let j = i;
      while (j < code.length && /\s/.test(code[j])) j++;
      if (code[j] === ":") {
        result += `<span style="color:#79c0ff">${str}</span>`;
      } else {
        result += `<span style="color:#a5d6ff">${str}</span>`;
      }
      continue;
    }

    // Number
    if (/[-\d]/.test(char)) {
      let num = "";
      while (i < code.length && /[\d.eE+-]/.test(code[i])) {
        num += code[i];
        i++;
      }
      result += `<span style="color:#a5d6ff">${num}</span>`;
      continue;
    }

    // Boolean / null
    if (code.slice(i, i + 4) === "true") {
      result += `<span style="color:#ff7b72">true</span>`;
      i += 4;
      continue;
    }
    if (code.slice(i, i + 5) === "false") {
      result += `<span style="color:#ff7b72">false</span>`;
      i += 5;
      continue;
    }
    if (code.slice(i, i + 4) === "null") {
      result += `<span style="color:#ff7b72">null</span>`;
      i += 4;
      continue;
    }

    // Punctuation
    if (/[{}\[\]:,]/.test(char)) {
      result += `<span style="color:#6e7681">${char}</span>`;
      i++;
      continue;
    }

    // Unrecognized characters (broken JSON) - gray
    result += `<span style="color:#6e7681">${char}</span>`;
    i++;
  }

  return result;
}
