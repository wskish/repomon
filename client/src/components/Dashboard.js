import React, { useState, useEffect, useRef, useMemo } from 'react';
import DiffCard from './DiffCard';
import { getFileTypeColor } from '../utils/fileUtils';
import { parseDiff } from '../utils/diffParser';
import { FiPlusCircle, FiMinusCircle } from 'react-icons/fi';
import '../styles/Dashboard.css';

const Dashboard = ({ repoStatus }) => {
  const [fontSize, setFontSize] = useState(14);
  const dashboardRef = useRef(null);
  const { files, branch } = repoStatus;

  // Calculate total changes across all files
  const totalChanges = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    
    files.forEach(file => {
      const parsed = parseDiff(file.diff);
      if (parsed && parsed.stats) {
        additions += parsed.stats.additions;
        deletions += parsed.stats.deletions;
      }
    });
    
    return { additions, deletions };
  }, [files]);

  // Adjust font size based on number of files and window size
  useEffect(() => {
    const calculateFontSize = () => {
      const baseFontSize = 16;
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
        <div className="branch-info">
          <h2>Branch: {branch}</h2>
          <div className="file-count">
            {files.length} file{files.length !== 1 ? 's' : ''} changed
          </div>
        </div>
        <div className="total-changes">
          {totalChanges.additions > 0 && (
            <span className="additions">
              <FiPlusCircle className="additions-icon" />
              {totalChanges.additions}
            </span>
          )}
          {totalChanges.deletions > 0 && (
            <span className="deletions">
              <FiMinusCircle className="deletions-icon" />
              {totalChanges.deletions}
            </span>
          )}
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
