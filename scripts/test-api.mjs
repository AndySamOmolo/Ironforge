// Test ExerciseDB API
const run = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/exercisedb?endpoint=exercises&limit=2&offset=0');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const keys = Object.keys(data[0]);
      console.log('FIELDS:', keys.join(', '));
      console.log('---');
      for (const ex of data) {
        console.log('name:', ex.name);
        console.log('gifUrl:', ex.gifUrl);
        console.log('gifPath:', ex.gifPath);
        console.log('imageUrl:', ex.imageUrl);
        // Check for any key containing 'gif' or 'image'
        for (const k of keys) {
          if (k.toLowerCase().includes('gif') || k.toLowerCase().includes('image') || k.toLowerCase().includes('url')) {
            console.log(`  ${k}:`, String(ex[k]).substring(0, 80));
          }
        }
        console.log('---');
      }
    } else {
      console.log('Response:', JSON.stringify(data).substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
};
run();
