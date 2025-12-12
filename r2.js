import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
    region: "auto",
    endpoint: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
    credentials: {
        accessKeyId: "6849c797bbf794469b621934caa166d1",
        secretAccessKey: "https://6849c797bbf794469b621934caa166d1.r2.cloudflarestorage.com"
    }
});

export async function uploadToR2(buffer, filename) {
    try {
        const bucketName = "videyku-thumbnail";

        await r2.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: filename,
            Body: buffer,
            ContentType: "image/jpeg",
        }));

        return `https://pub-<PUBLIC_ID>.r2.dev/${filename}`;
    } catch (err) {
        console.error("Upload error:", err);
        return null;
    }
}
