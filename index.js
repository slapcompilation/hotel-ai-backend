const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

app.post('/ai/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioPath = req.file.path;

    // Upload audio to AssemblyAI
    const uploadRes = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      fs.createReadStream(audioPath),
      {
        headers: {
          authorization: process.env.ASSEMBLY_API_KEY,
          'transfer-encoding': 'chunked',
        },
      }
    );

    const audioUrl = uploadRes.data.upload_url;

    // Start transcription
    const transcriptRes = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: audioUrl },
      {
        headers: {
          authorization: process.env.ASSEMBLY_API_KEY,
        },
      }
    );

    const transcriptId = transcriptRes.data.id;
    let completed = false;
    let transcriptText = '';

    // Poll until transcription is ready
    while (!completed) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const pollingRes = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            authorization: process.env.ASSEMBLY_API_KEY,
          },
        }
      );

      if (pollingRes.data.status === 'completed') {
        completed = true;
        transcriptText = pollingRes.data.text;
      } else if (pollingRes.data.status === 'error') {
        throw new Error('Transcription failed');
      }
    }

    res.json({ text: transcriptText });

    // Clean up uploaded file
    fs.unlinkSync(audioPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// This is required for Render to know where to listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
