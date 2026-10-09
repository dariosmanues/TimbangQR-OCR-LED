import fs from 'fs';
import path from 'path';

async function download(url, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  console.log(`Downloading ${url} to ${dest}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`Saved ${dest} (${buf.length} bytes)`);
}

async function main() {
  await download('https://raw.githubusercontent.com/Shreeshrii/tessdata_ssd/master/ssd_int.traineddata', 'public/tessdata/ssd_int.traineddata');
  await download('https://raw.githubusercontent.com/Shreeshrii/tessdata_ssd/master/ssd.traineddata', 'public/tessdata/ssd.traineddata');
}

main().catch(console.error);
