import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";

// Reuse client if possible or create new one (lightweight)
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function transcribeAudio(audioBuffer: Buffer): Promise<string | null> {
    try {
        // OpenAI requires a file object (or ReadStream), not just buffer for some SDK versions.
        // Easiest is to write to temp file.
        const tempPath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);
        fs.writeFileSync(tempPath, audioBuffer);

        const response = await client.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: "whisper-1",
            language: "pt", // optimizing for Portuguese
            temperature: 0.2
        });

        // Cleanup
        fs.unlinkSync(tempPath);

        return response.text || null;
    } catch (e) {
        console.error("Transcription error:", e);
        return null;
    }
}
