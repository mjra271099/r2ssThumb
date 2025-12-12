const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const AWS = require("aws-sdk");
const fs = require("fs");

const app = express();
const upload = multer();

// ====== SETUP S3 (Cloudflare R2 compatible) =======
const s3 = new AWS.S3({
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_KEY,
    secretAccessKey: process.env.R2_SECRET,
    s3ForcePathStyle: true,
    signatureVersion: "v4"
});

// ==================================================
// 1. API: Ambil frame detik ke-3 dari video online
// ==================================================
app.post("/capture", upload.none(), async (req, res) => {
    const { url, id } = req.body;

    if (!url || !id) {
        return res.status(400).json({ error: "url & id wajib diisi" });
    }

    console.log("▶ Memproses video:", url);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: "/usr/bin/chromium-browser" // shared hosting biasanya disini
        });
    } catch (err) {
        console.log("‼ Chromium tidak ditemukan di hosting:", err.message);
        return res.status(500).json({
            error: "Chromium tidak tersedia di server. Puppeteer tidak bisa berjalan."
        });
    }

    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "networkidle2" });

        // Tunggu video element muncul
        await page.waitForSelector("video");

        // Pindah ke detik ke 3
        await page.evaluate(() => {
            const vid = document.querySelector("video");
            vid.currentTime = 3;
        });

        // Tunggu frame berubah
        await page.waitForTimeout(1500);

        // Screenshot frame
        const buffer = await page.screenshot({ type: "jpeg" });

        await browser.close();

        // ============================================
        // Upload ke Cloudflare R2
        // ============================================
        const fileName = `${id}.jpg`;

        await s3
            .putObject({
                Bucket: process.env.R2_BUCKET,
                Key: fileName,
                Body: buffer,
                ContentType: "image/jpeg"
            })
            .promise();

        return res.json({
            success: true,
            file: fileName
        });

    } catch (err) {
        console.error(err);
        if (browser) await browser.close();
        return res.status(500).json({ error: "Gagal mengambil frame video" });
    }
});

// Home
app.get("/", (req, res) => {
    res.send("Frame Capture API Running (Shared Hosting Safe)");
});

// Server start
app.listen(3000, () => {
    console.log("Server berjalan di port 3000");
});
