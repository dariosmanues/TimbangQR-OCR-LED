import sharp from 'sharp';

async function cropSpans() {
  const spans = [
    { name: 'span_1', left: 135, width: 35 },
    { name: 'span_2', left: 168, width: 35 },
    { name: 'span_3', left: 195, width: 50 },
    { name: 'span_4', left: 242, width: 50 },
    { name: 'span_5', left: 290, width: 30 },
    { name: 'span_6', left: 315, width: 32 },
  ];
  for (const s of spans) {
    await sharp('scripts/new_crop.png')
      .extract({ left: s.left, top: 0, width: s.width, height: 114 })
      .toFile(`scripts/${s.name}.png`);
    console.log(`Saved scripts/${s.name}.png`);
  }
}
cropSpans();
