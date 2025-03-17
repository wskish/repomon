import React, { useState, useEffect, useRef } from 'react';
import DiffCard from './DiffCard';
import { getFileTypeColor } from '../utils/fileUtils';
import '../styles/Dashboard.css';

const Dashboard = ({ repoStatus }) => {
  const [fontSize, setFontSize] = useState(14);
  const dashboardRef = useRef(null);
  const { files, branch } = repoStatus;

  // Adjust font size based on number of files and window size
  useEffect(() => {
    const calculateFontSize = () => {
      const baseFontSize = 14;
      const fileCount = files.length;
      
      // Decrease font size as number of files increases
      if (fileCount <= 2) return baseFontSize;
      if (fileCount <= 4) return baseFontSize - 1;
      if (fileCount <= 8) return baseFontSize - 2;
      return baseFontSize - 3;
    };
    
    setFontSize(calculateFontSize());
    
    // Update font size on window resize
    const resizeObserver = new ResizeObserver(() => {
      setFontSize(calculateFontSize());
    });
    
    if (dashboardRef.current) {
      resizeObserver.observe(dashboardRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [files.length]);

  return (
    <div className="dashboard" ref={dashboardRef} style={{ fontSize: `${fontSize}px` }}>
      <div className="dashboard-header">
        <h2>Branch: {branch}</h2>
        <div className="file-count">
          {files.length} file{files.length !== 1 ? 's' : ''} changed
        </div>
      </div>
      
      <div className="diff-cards-container">
        {files.map((file) => (
          <DiffCard
            key={file.file}
            file={file}
            color={getFileTypeColor(file.file)}
            fontSize={fontSize}
          />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
