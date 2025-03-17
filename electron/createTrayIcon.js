// Create a basic tray icon programmatically
const { nativeImage } = require('electron');

/**
 * Creates a simple tray icon as a fallback
 * @returns {Electron.NativeImage} 
 */
function createTrayIcon() {
  const size = 16; // 16x16 pixels
  const image = nativeImage.createEmpty();
  
  // Create a 16x16 transparent image with a green dot
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  
  // Draw transparent background
  ctx.clearRect(0, 0, size, size);
  
  // Draw a green circle
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 3, 0, 2 * Math.PI);
  ctx.fillStyle = '#4CAF50';
  ctx.fill();
  
  // Set the image data
  const imageData = ctx.getImageData(0, 0, size, size);
  image.addRepresentation({
    scaleFactor: 1.0,
    width: size,
    height: size,
    buffer: Buffer.from(imageData.data)
  });
  
  return image;
}

module.exports = createTrayIcon;