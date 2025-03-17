/**
 * Parse raw git diff output into a structured format
 * @param {string} diff - Raw git diff output
 * @returns {Object} Parsed diff information
 */
export const parseDiff = (diff) => {
  if (!diff || typeof diff !== 'string') {
    return null;
  }
  
  // Split diff into lines
  const lines = diff.split('\n');
  
  // Initialize result object
  const result = {
    hunks: []
  };
  
  let currentHunk = null;
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for hunk header
    if (line.startsWith('@@')) {
      // Extract line numbers from hunk header
      // Format: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      
      if (match) {
        // Create new hunk
        currentHunk = {
          header: line,
          oldStart: parseInt(match[1], 10),
          newStart: parseInt(match[2], 10),
          lines: []
        };
        
        result.hunks.push(currentHunk);
      }
    } 
    // Add line to current hunk
    else if (currentHunk) {
      // Skip file metadata lines
      if (!line.startsWith('diff --git') && 
          !line.startsWith('index ') && 
          !line.startsWith('---') && 
          !line.startsWith('+++')) {
        currentHunk.lines.push(line);
      }
    }
  }
  
  return result;
};
