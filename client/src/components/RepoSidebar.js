import React from 'react';
import { FiPlus, FiGitBranch, FiTrash2, FiFolder, FiChevronRight, FiPlusCircle, FiMinusCircle } from 'react-icons/fi';
import '../styles/RepoSidebar.css';

const RepoSidebar = ({ 
  repositories, 
  currentRepo, 
  onAddRepo, 
  onSelectRepo, 
  onRemoveRepo 
}) => {
  return (
    <div className="repo-sidebar">
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
              <div className="repo-icon">
                <FiFolder />
              </div>
              <div className="repo-info">
                <div className="repo-name">{repo.name}</div>
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
              <button 
                className="remove-repo-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveRepo(repo.path);
                }}
                title="Remove Repository"
              >
                <FiTrash2 />
              </button>
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