const chokidar = require('chokidar');
const { simpleGit } = require('simple-git');
const debounce = require('debounce');
const path = require('path');
const fs = require('fs');

class GitMonitor {
  // Parse diff stats from raw diff output
  parseDiffStats(diffText) {
    if (!diffText) return { additions: 0, deletions: 0 };
    
    let additions = 0;
    let deletions = 0;
    
    // Split diff by lines
    const lines = diffText.split('\n');
    
    // Count additions and deletions
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
    
    return { additions, deletions };
  }
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this.watcher = null;
    this.isGitRepo = false;
    
    // Check if path exists
    if (!fs.existsSync(repoPath)) {
      console.error(`Repository path does not exist: ${repoPath}`);
      return;
    }
    
    // Check if .git directory exists directly
    if (fs.existsSync(path.join(repoPath, '.git'))) {
      console.log(`Found .git directory at ${repoPath}`);
      this.isGitRepo = true;
    } else {
      // Fallback to Git's own check
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
                const filePath = path.join(this.repoPath, file);
                
                // Check if it's a directory
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                  diff = `diff --git a/${file} b/${file}\nnew file mode 100644\nindex 0000000..0000000\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,1 @@\n+<Directory: ${file}>\n`;
                } else {
                  // It's a regular file
                  const content = fs.readFileSync(filePath, 'utf8');
                  diff = `diff --git a/${file} b/${file}\nnew file mode 100644\nindex 0000000..0000000\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split('\n').length} @@\n${content.split('\n').map(line => `+${line}`).join('\n')}`;
                }
              } catch (readErr) {
                console.error(`Error reading file ${file}:`, readErr);
                diff = `Unable to read file: ${readErr.message}`;
              }
            } else if (status.deleted.includes(file)) {
              // For deleted files, get diff from git
              try {
                diff = await this.git.diff(['--diff-algorithm=histogram', '--', file]);
              } catch (diffErr) {
                console.error(`Error getting diff for deleted file ${file}:`, diffErr);
                diff = `diff --git a/${file} b/${file}\ndeleted file mode 100644\nindex 0000000..0000000\n--- a/${file}\n+++ /dev/null\n@@ -1 +0,0 @@\n-<File deleted: ${file}>\n`;
              }
            } else {
              // For modified files, try to get diff
              try {
                // Check if it's a binary file
                const filePath = path.join(this.repoPath, file);
                if (fs.existsSync(filePath)) {
                  const stats = fs.statSync(filePath);
                  
                  if (stats.isDirectory()) {
                    diff = `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-<Directory>\n+<Directory: modified>\n`;
                  } else {
                    // Try to do a git diff first
                    try {
                      diff = await this.git.diff(['--diff-algorithm=histogram', '--', file]);
                    } catch (diffErr) {
                      // If git diff fails (maybe binary file), use a placeholder
                      diff = `diff --git a/${file} b/${file}\nmodified file mode 100644\nindex 0000000..0000000\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-<File content before>\n+<File modified: ${file}>\n`;
                    }
                  }
                } else {
                  diff = `diff --git a/${file} b/${file}\nindex 0000000..0000000\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-<File no longer exists>\n+<File reported as modified but not found>\n`;
                }
              } catch (err) {
                console.error(`Error processing modified file ${file}:`, err);
                diff = `Failed to process ${file}: ${err.message}`;
              }
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
  
  async startMonitoring(callback) {
    // If isGitRepo is false, do one more check in case constructor's async check hasn't finished
    if (!this.isGitRepo) {
      console.log('Repository check not confirmed yet, checking again...');
      
      // Direct check for .git directory
      if (fs.existsSync(path.join(this.repoPath, '.git'))) {
        console.log(`Found .git directory at ${this.repoPath}`);
        this.isGitRepo = true;
      } else {
        // One more try with Git's own check
        try {
          const isRepo = await this.git.checkIsRepo();
          this.isGitRepo = isRepo;
          if (isRepo) {
            console.log(`Confirmed valid Git repository at ${this.repoPath}`);
          } else {
            console.error('The specified path is not a Git repository');
            return; // Exit if not a repo
          }
        } catch (err) {
          console.error('Error checking if path is a git repository:', err);
          return; // Exit on error
        }
      }
    }
    
    if (!this.isGitRepo) {
      console.error('Cannot monitor: Not a Git repository');
      return;
    }
    
    console.log(`Starting to monitor repository at ${this.repoPath}`);
    
    // Initialize watcher with appropriate configuration
    this.watcher = chokidar.watch(this.repoPath, {
      ignored: [
        '**/node_modules/**',
        '**/build/**',
        '**/dist/**',
        // Common binary files and temp files
        '**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.gif',
        '**/*.db', '**/*.sqlite', '**/*.ico', '**/*.mov',
        '**/*.mp4', '**/*.mp3', '**/*.zip', '**/*.tar',
        '**/*.gz', '**/*.tgz', '**/*.7z', '**/*.pdf',
        '**/*.dmg', '**/*.pkg', '**/*.woff', '**/*.ttf',
        '**/._*', '**/Thumbs.db', '**/.DS_Store',
        '**/tmp/**', '**/temp/**'
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 200
      },
      ignorePermissionErrors: true,
      // Only watch actual files, not directories
      alwaysStat: true,
      depth: 5  // Limit depth to avoid excessive watching
    });
    
    // Also monitor .git directory for commit-related events, but with specific filters
    const gitDirWatcher = chokidar.watch(path.join(this.repoPath, '.git'), {
      ignored: [
        '**/.git/objects/**', // Ignore large object files
        '**/.git/logs/refs/**'
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 1,
      ignorePermissionErrors: true
    });
    
    // Create a highly debounced function to handle file changes
    const debouncedCallback = debounce(async () => {
      console.log(`File change detected, checking git status...`);
      try {
        // Wait a moment for Git to register changes
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const status = await this.getStatus();
        // Always send update even if no files are changed
        // This ensures UI is refreshed after commits, when diffs should be cleared
        if (status.files && status.files.length > 0) {
          console.log(`Detected ${status.files.length} changed files, sending update`);
        } else {
          console.log('No git changes detected, refreshing UI');
        }
        callback(status);
      } catch (err) {
        console.error('Error handling file change:', err);
      }
    }, 1000);  // Longer debounce for stability
    
    // Handle git operations specifically (like commits)
    const gitOperationCallback = debounce(async () => {
      console.log(`Git operation detected, refreshing status...`);
      try {
        // Wait a bit longer for Git operations to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const status = await this.getStatus();
        callback(status);
      } catch (err) {
        console.error('Error handling git operation:', err);
      }
    }, 800);
    
    // Use a single handler for all events to avoid multiple callbacks
    const fileChangeHandler = (event, filePath) => {
      console.log(`File ${event}: ${filePath}`);
      debouncedCallback();
    };
    
    // Watch for all file events
    this.watcher
      .on('add', (filePath) => fileChangeHandler('added', filePath))
      .on('change', (filePath) => fileChangeHandler('changed', filePath))
      .on('unlink', (filePath) => fileChangeHandler('removed', filePath))
      .on('error', (error) => console.error(`Watcher error: ${error}`));
    
    // Watch for git operations
    gitDirWatcher
      .on('add', (filePath) => {
        console.log(`Git file added: ${filePath}`);
        gitOperationCallback();
      })
      .on('change', (filePath) => {
        console.log(`Git file changed: ${filePath}`);
        gitOperationCallback();
      })
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
