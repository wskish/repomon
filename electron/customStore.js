/**
 * Simple store implementation to replace electron-store
 * This provides basic persistence without dependency issues
 */
const fs = require('fs');
const path = require('path');
const electron = require('electron');

class CustomStore {
  constructor(options = {}) {
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.path = path.join(userDataPath, `${options.name || 'config'}.json`);
    this.data = {};
    
    // Load data from file if it exists
    try {
      if (fs.existsSync(this.path)) {
        const fileContent = fs.readFileSync(this.path, 'utf8');
        this.data = JSON.parse(fileContent);
      }
    } catch (error) {
      console.error(`Error loading store from ${this.path}:`, error);
    }
  }
  
  // Get a value from the store
  get(key, defaultValue) {
    if (key == null) {
      return this.data;
    }
    
    const value = this.data[key];
    return value !== undefined ? value : defaultValue;
  }
  
  // Set a value in the store
  set(key, value) {
    if (typeof key === 'object') {
      // Handle object assignment
      this.data = { ...this.data, ...key };
    } else {
      this.data[key] = value;
    }
    
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write to file
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error(`Error saving store to ${this.path}:`, error);
    }
    
    return this;
  }
  
  // Delete a key from the store
  delete(key) {
    delete this.data[key];
    
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error(`Error saving store to ${this.path}:`, error);
    }
    
    return this;
  }
  
  // Clear the entire store
  clear() {
    this.data = {};
    
    try {
      fs.writeFileSync(this.path, '{}');
    } catch (error) {
      console.error(`Error clearing store at ${this.path}:`, error);
    }
    
    return this;
  }
}

module.exports = CustomStore;