const apiKey = process.argv[2];
const model = 'gemini-3.5-flash';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hello in 5 words.' }] }] }),
})
  .then(async (res) => {
    const data = await res.json();
    console.log('Status:', res.status);
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((err) => console.error('Error:', err));
