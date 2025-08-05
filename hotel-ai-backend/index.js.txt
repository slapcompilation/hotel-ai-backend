const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");

const app = express();
const upload = multer({ dest: "uploads/" });

const PORT = process.env.PORT || 3000;

app.post("/ai/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const audioPath = req.file.path;

    const uploadRes = await axios({
      method: "post",
      url: "https://api.assemblyai.com/v2/upload",
      headers: {
        authorization: process.env.ASSEMBLY_API_KEY,
        "transfer-encoding": "chunked",
      },
      data: fs.createReadStream(audioPath),
    });

    const audioUrl = uploadRes.data.upload_url;

    const transcriptRes = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      { audio_url: audioUrl },
      {
        headers: {
          authorization: process.env.ASSEMBLY_API_KEY,
          "content-type": "application/json",
        },
      }
    );

    const transcriptId = transcriptRes.data.id;

    let transcript;
    while (true) {
      const statusRes = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: { authorization: process.env.ASSEMBLY_API_KEY },
        }
      );

      if (statusRes.data.status === "completed") {
        transcript = statusRes.data.text;
        break;
      } else if (statusRes.data.status === "error") {
        throw new Error("Transcription failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    res.json({ text: transcript });
    fs.unlinkSync(audioPath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Transcription failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
