const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const AWS = require("aws-sdk");
const fs = require("fs");

const app = express();
const upload = multer();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ========= SETUP S3 (Cloudflare R2 Compatible) =============
const s3 = new AWS.S3({
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_KEY,
    secretAccessKey: process.env.R2_SECRET,
    s3ForcePathStyle: true,
    signatureVersion: "v4"
});

// ==========================================================
// 1. API: Ambil satu frame dari video online (detik ke-3)
// ==========================================================
app.post("/capture", upload.none(), async (req, res) => {
    const { url, id } = req.body;

    if (!url || !id) {
        return res.status(400).json({ error: "url & id wajib diisi" });
    }

    console.log("▶ Memproses:", url);

    let browser;
    try {
        // Launch Puppeteer — shared hosting kompatibel
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage"
            ],
            // Chromium di shared hosting biasanya TIDAK ADA
            executablePath: "/usr/bin/chromium-browser"
        });
    } catch (err) {
        console.log("‼ Puppeteer gagal start:", err.message);

        return res.status(500).json({
            error: "Chromium tidak tersedia di server shared hosting. Puppeteer tidak bisa dijalankan."
        });
    }

    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        // tunggu video element
        await page.waitForSelector("video");

        // set detik ke-3
        await page.evaluate(() => {
            const vid = document.querySelector("video");
            vid.currentTime = 3;
        });

        await page.waitForTimeout(1500);

        // screenshot frame
        const buffer = await page.screenshot({ type: "jpeg" });

        await browser.close();

        const fileName = `${id}.jpg`;

        // Upload ke Cloudflare R2
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
            message: "Berhasil mengambil frame",
            file: fileName
        });

    } catch (err) {
        console.error("‼ ERROR:", err);

        if (browser) await browser.close();

        return res.status(500).json({
            error: "Gagal mengambil frame video"
        });
    }
});

// Homepage
app.get("/", (req, res) => {
    res.send("API Frame Capture | Shared Hosting Ready");
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server berjalan di port", PORT);
});
