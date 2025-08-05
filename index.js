import express from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

app.post('/ai/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioPath = req.file.path;

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

    fs.unlinkSync(audioPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ✅ This is critical for Render to know where to bind
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
