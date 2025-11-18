#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const filePath = 'src/test/integration/error-handling.test.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all testContext.updateChat references
content = content.replace(/await testContext\.updateChat\(/g, 'await chatMock.updateValue(');

// Replace all testContext.updateConversations references  
content = content.replace(/await testContext\.updateConversations\(/g, 'await conversationsMock.updateValue(');

// Replace all testContext.renderComponent references
content = content.replace(/testContext\.renderComponent\(<ChatInterface \/>\);/g, 
  'const { rerender } = render(<ChatInterface />);\n      rerender(<ChatInterface />);');

// Write the updated content back
fs.writeFileSync(filePath, content);

console.log('Updated all testContext references in error-handling.test.tsx');