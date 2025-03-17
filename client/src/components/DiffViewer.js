import React, { useMemo } from 'react';
import { parseDiff } from '../utils/diffParser';
import '../styles/DiffViewer.css';

const DiffViewer = ({ diff, fontSize }) => {
  // Parse the diff output
  const parsedDiff = useMemo(() => parseDiff(diff), [diff]);
  
  if (!parsedDiff || !parsedDiff.hunks || parsedDiff.hunks.length === 0) {
    return <div className="empty-diff">No changes to display</div>;
  }

  return (
    <div className="diff-viewer" style={{ fontSize: `${fontSize}px` }}>
      <div className="diff-table-container">
        <table className="diff-table">
          <tbody>
            {parsedDiff.hunks.map((hunk, hunkIndex) => (
              <React.Fragment key={hunkIndex}>
                <tr className="hunk-header">
                  <td className="line-number"></td>
                  <td className="line-number"></td>
                  <td className="hunk-info" colSpan={2}>
                    {hunk.header}
                  </td>
                </tr>
                
                {hunk.lines.map((line, lineIndex) => {
                  const type = line.startsWith('+') ? 'added' : 
                               line.startsWith('-') ? 'removed' : 
                               line.startsWith('\\') ? 'comment' : 'unchanged';
                  
                  return (
                    <tr key={`${hunkIndex}-${lineIndex}`} className={`diff-line ${type}`}>
                      {/* Left side (old) */}
                      <td className="line-number">
                        {type !== 'added' && hunk.oldStart + lineIndex}
                      </td>
                      <td className={`line-content ${type}`}>
                        {type !== 'added' && line.substring(1)}
                      </td>
                      
                      {/* Right side (new) */}
                      <td className="line-number">
                        {type !== 'removed' && hunk.newStart + lineIndex}
                      </td>
                      <td className={`line-content ${type}`}>
                        {type !== 'removed' && line.substring(1)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DiffViewer;
