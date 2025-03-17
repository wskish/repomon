const chokidar = require('chokidar');
const { simpleGit } = require('simple-git');
const debounce = require('debounce');
const path = require('path');
const fs = require('fs');

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
        }
      });
  }
  
  async getStatus() {
    if (!this.isGitRepo) return { error: 'Not a Git repository' };
    
    try {
      // Get current status
      const status = await this.git.status();
      
      // Get detailed diff for each modified file
      const diffs = await Promise.all(
        [...status.modified, ...status.created, ...status.deleted].map(async (file) => {
          let diff;
          try {
            if (status.created.includes(file)) {
              // For new files, show the entire file as added
              const content = fs.readFileSync(path.join(this.repoPath, file), 'utf8');
              diff = `diff --git a/${file} b/${file}\nnew file mode 100644\nindex 0000000..0000000\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split('\n').length} @@\n${content.split('\n').map(line => `+${line}`).join('\n')}`;
            } else if (status.deleted.includes(file)) {
              // For deleted files, get diff from git
              diff = await this.git.diff(['--', file]);
            } else {
              // For modified files, get diff from git
              diff = await this.git.diff(['--', file]);
            }
            return {
              file,
              status: status.created.includes(file) ? 'added' : 
                      status.modified.includes(file) ? 'modified' : 'deleted',
              diff
            };
          } catch (error) {
            console.error(`Error getting diff for ${file}:`, error);
            return {
              file,
              status: status.created.includes(file) ? 'added' : 
                      status.modified.includes(file) ? 'modified' : 'deleted',
              diff: 'Error getting diff'
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
    
    // Initialize watcher
    this.watcher = chokidar.watch(this.repoPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/build/**',
        '**/dist/**'
      ],
      persistent: true,
      ignoreInitial: true
    });
    
    // Debounce the callback to prevent rapid successive updates
    const debouncedCallback = debounce(async () => {
      const status = await this.getStatus();
      callback(status);
    }, 300);
    
    // Watch for file changes
    this.watcher
      .on('add', debouncedCallback)
      .on('change', debouncedCallback)
      .on('unlink', debouncedCallback);
    
    console.log(`Monitoring repository at ${this.repoPath}`);
  }
  
  stopMonitoring() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('Stopped monitoring repository');
    }
  }
}

module.exports = GitMonitor;
