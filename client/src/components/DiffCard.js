import React, { useState } from 'react';
import DiffViewer from './DiffViewer';
import { FiMaximize, FiMinimize, FiFileText } from 'react-icons/fi';
import '../styles/DiffCard.css';

const DiffCard = ({ file, color, fontSize }) => {
  const [expanded, setExpanded] = useState(false);
  const { file: filePath, status, diff } = file;
  
  // Extract filename from path
  const fileName = filePath.split('/').pop();
  
  // Get status badge class
  const getStatusClass = () => {
    switch(status) {
      case 'added': return 'status-added';
      case 'modified': return 'status-modified';
      case 'deleted': return 'status-deleted';
      default: return '';
    }
  };

  const toggleExpand = (e) => {
    // Don't toggle if clicking directly on a link or button in the content
    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || 
        e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    setExpanded(!expanded);
  };

  return (
    <div 
      className={`diff-card ${expanded ? 'expanded' : ''}`} 
      style={{ borderLeftColor: color }}
      onClick={toggleExpand}
    >
      <div className="diff-card-header">
        <div className="file-info">
          <FiFileText className="file-icon" />
          <span className="file-name">{fileName}</span>
          <span className="file-path">{filePath.replace(fileName, '')}</span>
          <span className={`file-status ${getStatusClass()}`}>{status}</span>
        </div>
        <button
          className="expand-button"
          onClick={(e) => {
            e.stopPropagation(); // Prevent event from bubbling up to card
            setExpanded(!expanded);
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <FiMinimize /> : <FiMaximize />}
        </button>
      </div>
      
      <div className={`diff-card-content ${expanded ? 'show' : ''}`}>
        <DiffViewer diff={diff} fontSize={fontSize} />
        {!expanded && (
          <div className="expand-hint">
            Click anywhere on card to expand
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffCard;
