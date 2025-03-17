/**
 * Get color code based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} Hex color code
 */
export const getFileTypeColor = (filePath) => {
  const extension = filePath.split('.').pop().toLowerCase();
  
  // Define colors for common file types
  const colorMap = {
    // Code files
    js: '#f7df1e',      // JavaScript
    jsx: '#61dafb',     // React JSX
    ts: '#3178c6',      // TypeScript
    tsx: '#61dafb',     // TypeScript React
    py: '#3572A5',      // Python
    java: '#b07219',    // Java
    c: '#555555',       // C
    cpp: '#f34b7d',     // C++
    cs: '#178600',      // C#
    go: '#00ADD8',      // Go
    rb: '#CC342D',      // Ruby
    php: '#4F5D95',     // PHP
    
    // Web files
    html: '#e34c26',    // HTML
    css: '#563d7c',     // CSS
    scss: '#c6538c',    // SCSS
    sass: '#c6538c',    // Sass
    less: '#1d365d',    // Less
    
    // Data files
    json: '#292929',    // JSON
    xml: '#0060ac',     // XML
    yaml: '#cb171e',    // YAML
    yml: '#cb171e',     // YML
    csv: '#237346',     // CSV
    
    // Config files
    md: '#083fa1',      // Markdown
    txt: '#4f4f4f',     // Text
    gitignore: '#f05033', // Git
    
    // Default color
    default: '#808080'  // Gray
  };
  
  return colorMap[extension] || colorMap.default;
};
