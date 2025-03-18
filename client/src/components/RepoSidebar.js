import React, { useState } from 'react';
import { FiPlus, FiGitBranch, FiFolder, FiChevronRight, FiPlusCircle, FiMinusCircle, FiTrash2, FiCode } from 'react-icons/fi';
import '../styles/RepoSidebar.css';

const RepoSidebar = ({ 
  repositories, 
  currentRepo, 
  onAddRepo, 
  onSelectRepo, 
  onRemoveRepo,
  onOpenInEditor 
}) => {
  const [menuOpen, setMenuOpen] = useState(null);

  const handleFolderClick = (e, repoPath) => {
    e.stopPropagation();
    setMenuOpen(menuOpen === repoPath ? null : repoPath);
  };

  const handleClickOutside = () => {
    if (menuOpen) {
      setMenuOpen(null);
    }
  };

  return (
    <div className="repo-sidebar" onClick={handleClickOutside}>
      <div className="sidebar-header">
        <h2>Repositories</h2>
        <button 
          className="add-repo-btn" 
          onClick={onAddRepo}
          title="Add Repository"
        >
          <FiPlus />
        </button>
      </div>
      
      <div className="repo-list">
        {repositories.length === 0 ? (
          <div className="no-repos">
            <p>No repositories</p>
            <button onClick={onAddRepo}>Add Repository</button>
          </div>
        ) : (
          repositories.map((repo) => (
            <div 
              key={repo.path}
              className={`repo-item ${currentRepo === repo.path ? 'active' : ''}`}
              onClick={() => onSelectRepo(repo.path)}
            >
              <div className="repo-item-header">
                <div 
                  className="repo-icon"
                  onClick={(e) => handleFolderClick(e, repo.path)}
                  title="Repository options"
                >
                  <FiFolder />
                  
                  {menuOpen === repo.path && (
                    <div className="repo-menu">
                      <button
                        className="repo-menu-item repo-menu-editor"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(null);
                          onOpenInEditor && onOpenInEditor(repo.path);
                        }}
                      >
                        <FiCode />
                        <span>Open in VS Code</span>
                      </button>
                      <button
                        className="repo-menu-item repo-menu-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(null);
                          onRemoveRepo(repo.path);
                        }}
                      >
                        <FiTrash2 />
                        <span>Remove Repository</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="repo-name">{repo.name}</div>
              </div>
              
              <div className="repo-details-row">
                <div className="repo-details">
                  {repo.branch && (
                    <div className="repo-branch">
                      <FiGitBranch className="branch-icon" />
                      {repo.branch}
                    </div>
                  )}
                </div>
                <div className="repo-stats">
                  {repo.changedFiles > 0 && (
                    <div className="changed-files">
                      {repo.changedFiles} {repo.changedFiles === 1 ? 'file' : 'files'}
                    </div>
                  )}
                  <div className="change-stats">
                    {repo.additions > 0 && (
                      <span className="additions">
                        <FiPlusCircle className="additions-icon" />
                        {repo.additions}
                      </span>
                    )}
                    {repo.deletions > 0 && (
                      <span className="deletions">
                        <FiMinusCircle className="deletions-icon" />
                        {repo.deletions}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {currentRepo === repo.path && (
                <div className="active-indicator">
                  <FiChevronRight />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RepoSidebar;