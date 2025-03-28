const chokidar = require('chokidar');
const { simpleGit } = require('simple-git');
const debounce = require('debounce');
const path = require('path');
const fs = require('fs');
const { Notification } = require('electron');

class GitMonitor {
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this.watcher = null;
    this.isGitRepo = false;
    
    // Check if path is a git repository
    this.git.checkIsRepo()
      .then(isRepo => {
        this.isGitRepo = isRepo;
        if (!isRepo) {
          console.error('The specified path is not a Git repository');
        } else {
          console.log(`Confirmed valid Git repository at ${repoPath}`);
        }
      })
      .catch(err => {
        console.error('Error checking if path is a git repository:', err);
      });
  }
  
  async getStatus() {
    if (!this.isGitRepo) return { error: 'Not a Git repository' };
    
    try {
      // Get current status
      const status = await this.git.status();
      console.log('Git status:', {
        branch: status.current,
        modified: status.modified.length,
        created: status.created.length,
        deleted: status.deleted.length,
        staged: status.staged.length
      });
      
      // Get detailed diff for each modified file
      const diffs = await Promise.all(
        [...status.modified, ...status.created, ...status.deleted, ...status.not_added].map(async (file) => {
          let diff;
          try {
            if (status.created.includes(file) || status.not_added.includes(file)) {
              // For new/untracked files, show the entire file as added
              try {
                const content = fs.readFileSync(path.join(this.repoPath, file), 'utf8');
                diff = `diff --git a/${file} b/${file}\nnew file mode 100644\nindex 0000000..0000000\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split('\n').length} @@\n${content.split('\n').map(line => `+${line}`).join('\n')}`;
              } catch (readErr) {
                console.error(`Error reading file ${file}:`, readErr);
                diff = `Unable to read file: ${readErr.message}`;
              }
            } else if (status.deleted.includes(file)) {
              // For deleted files, get diff from git
              diff = await this.git.diff(['--diff-algorithm=histogram', '--', file]);
            } else {
              // For modified files, get diff from git
              diff = await this.git.diff(['--diff-algorithm=histogram', '--', file]);
            }
            return {
              file,
              status: status.created.includes(file) || status.not_added.includes(file) ? 'added' : 
                      status.modified.includes(file) ? 'modified' : 'deleted',
              diff
            };
          } catch (error) {
            console.error(`Error getting diff for ${file}:`, error);
            return {
              file,
              status: status.created.includes(file) || status.not_added.includes(file) ? 'added' : 
                      status.modified.includes(file) ? 'modified' : 'deleted',
              diff: `Error getting diff: ${error.message}`
            };
          }
        })
      );
      
      return {
        branch: status.current,
        files: diffs
      };
    } catch (error) {
      console.error('Error getting repository status:', error);
      return { error: error.message };
    }
  }
  
  startMonitoring(callback) {
    if (!this.isGitRepo) {
      console.error('Cannot monitor: Not a Git repository');
      return;
    }
    
    // Initialize watcher with appropriate configuration
    this.watcher = chokidar.watch(this.repoPath, {
      ignored: [
        '**/node_modules/**',
        '**/build/**',
        '**/dist/**'
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      },
      ignorePermissionErrors: true
    });
    
    // Also monitor .git directory for commit-related events
    const gitDirWatcher = chokidar.watch(path.join(this.repoPath, '.git'), {
      ignored: ['**/.git/objects/**'], // Ignore large object files
      persistent: true,
      ignoreInitial: true,
      depth: 1,
      ignorePermissionErrors: true
    });
    
    // Create a debounced function to handle file changes
    const debouncedCallback = debounce(async (event, filePath) => {
      console.log(`File ${event}: ${filePath}`);
      try {
        const status = await this.getStatus();
        
        // Always send update even if no files are changed
        // This ensures UI is refreshed after commits, when diffs should be cleared
        if (status.files && status.files.length > 0) {
          console.log(`Detected ${status.files.length} changed files, sending update`);
          
          // Send native OS notification
          if (process.platform === 'darwin' || process.platform === 'win32') {
            new Notification({
              title: 'Repository Changes Detected',
              body: `${status.files.length} file${status.files.length === 1 ? '' : 's'} changed`,
              silent: true
            }).show();
          }
        } else {
          console.log('No git changes detected, refreshing UI');
        }
        
        callback(status);
      } catch (err) {
        console.error('Error handling file change:', err);
      }
    }, 500);
    
    // Handle git operations specifically (like commits)
    const gitOperationCallback = debounce(async (event, filePath) => {
      console.log(`Git operation detected: ${filePath}`);
      // Always refresh UI after git operations
      try {
        const status = await this.getStatus();
        callback(status);
      } catch (err) {
        console.error('Error handling git operation:', err);
      }
    }, 500);
    
    // Watch for all file events
    this.watcher
      .on('add', (path) => debouncedCallback('added', path))
      .on('change', (path) => debouncedCallback('changed', path))
      .on('unlink', (path) => debouncedCallback('removed', path))
      .on('error', (error) => console.error(`Watcher error: ${error}`));
    
    // Watch for git operations (commits, merges, etc.)
    gitDirWatcher
      .on('add', (path) => gitOperationCallback('added', path))
      .on('change', (path) => gitOperationCallback('changed', path))
      .on('error', (error) => console.error(`Git watcher error: ${error}`));
    
    console.log(`Actively monitoring repository at ${this.repoPath}`);
    
    // Send initial status
    this.getStatus().then(status => {
      callback(status);
    }).catch(err => {
      console.error('Error getting initial status:', err);
    });
    
    // Save reference to gitDirWatcher
    this.gitDirWatcher = gitDirWatcher;
  }
  
  stopMonitoring() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    if (this.gitDirWatcher) {
      this.gitDirWatcher.close();
      this.gitDirWatcher = null;
    }
    
    console.log('Stopped monitoring repository');
  }
}

module.exports = GitMonitor;