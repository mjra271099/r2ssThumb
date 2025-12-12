import AWS from "aws-sdk";
import chromium from "chrome-aws-lambda";
import puppeteer from "puppeteer-core";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "POST only" });
    }

    const { url, id } = req.body;

    if (!url || !id) {
        return res.status(400).json({ error: "url & id wajib diisi" });
    }

    // Setup R2
    const s3 = new AWS.S3({
        endpoint: process.env.R2_ENDPOINT,
        accessKeyId: process.env.R2_KEY,
        secretAccessKey: process.env.R2_SECRET,
        s3ForcePathStyle: true,
        signatureVersion: "v4"
    });

    let browser;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath,
            headless: chromium.headless
        });
    } catch (err) {
        console.log("Chromium error:", err);
        return res.status(500).json({
            error: "Chromium tidak tersedia di Vercel."
        });
    }

    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "networkidle2" });

        await page.waitForSelector("video");

        await page.evaluate(() => {
            const v = document.querySelector("video");
            v.currentTime = 3;
        });

        await page.waitForTimeout(1500);

        const frame = await page.screenshot({ type: "jpeg" });

        await browser.close();

        const fileName = `${id}.jpg`;

        await s3
            .putObject({
                Bucket: process.env.R2_BUCKET,
                Key: fileName,
                Body: frame,
                ContentType: "image/jpeg"
            })
            .promise();

        return res.json({
            success: true,
            id,
            url,
            file: fileName
        });

    } catch (err) {
        console.error(err);
        if (browser) await browser.close();
        return res.status(500).json({ error: "Gagal mengambil frame" });
    }
}
