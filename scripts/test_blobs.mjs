import sharp from 'sharp';

async function testBlobs() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Lit LED segment:
    if (r >= 195 && (g >= 70 || lum >= 130)) {
      mask[i] = 1;
    }
  }

  // Find connected components (flood fill / BFS)
  const visited = new Uint8Array(width * height);
  const blobs = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1 && visited[idx] === 0) {
        // BFS
        let minX = x, maxX = x, minY = y, maxY = y;
        let count = 0;
        const queue = [x, y];
        visited[idx] = 1;
        let qHead = 0;

        while (qHead < queue.length) {
          const qx = queue[qHead++];
          const qy = queue[qHead++];
          count++;
          if (qx < minX) minX = qx;
          if (qx > maxX) maxX = qx;
          if (qy < minY) minY = qy;
          if (qy > maxY) maxY = qy;

          // 4 neighbors
          const neighbors = [
            [qx + 1, qy],
            [qx - 1, qy],
            [qx, qy + 1],
            [qx, qy - 1]
          ];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (mask[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push(nx, ny);
              }
            }
          }
        }

        if (count >= 15) {
          blobs.push({ minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, count });
        }
      }
    }
  }

  console.log('Blobs found (> 15 pixels):');
  for (const b of blobs) {
    console.log(`Blob: [x:${b.minX}..${b.maxX}, w:${b.w}, y:${b.minY}..${b.maxY}, h:${b.h}, count:${b.count}]`);
  }
}
testBlobs();
