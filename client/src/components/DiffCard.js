import React, { useState, useMemo } from 'react';
import DiffViewer from './DiffViewer';
import { FiMaximize, FiMinimize, FiFileText, FiPlusCircle, FiMinusCircle, FiCode } from 'react-icons/fi';
import '../styles/DiffCard.css';
import { parseDiff } from '../utils/diffParser';

const DiffCard = ({ file, color, fontSize, onOpenFileInEditor }) => {
  const [expanded, setExpanded] = useState(false);
  const { file: filePath, status, diff } = file;
  
  // Extract filename from path
  const fileName = filePath.split('/').pop();
  
  // Parse diff stats
  const diffStats = useMemo(() => {
    const parsed = parseDiff(diff);
    return parsed ? parsed.stats : { additions: 0, deletions: 0 };
  }, [diff]);
  
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
          {onOpenFileInEditor && status !== 'deleted' && (
            <button 
              className="open-in-editor-btn" 
              onClick={(e) => {
                e.stopPropagation();
                // Extract first changed line from the parsed diff
                const parsedDiff = parseDiff(diff);
                const lineNumber = parsedDiff?.firstChangedLine || 1;
                onOpenFileInEditor(filePath, lineNumber);
              }}
              title="Open file in VS Code at first change"
            >
              <FiCode />
            </button>
          )}
        </div>
        <div className="diff-stats">
          {diffStats.additions > 0 && (
            <span className="additions">
              <FiPlusCircle className="additions-icon" />
              {diffStats.additions}
            </span>
          )}
          {diffStats.deletions > 0 && (
            <span className="deletions">
              <FiMinusCircle className="deletions-icon" />
              {diffStats.deletions}
            </span>
          )}
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
