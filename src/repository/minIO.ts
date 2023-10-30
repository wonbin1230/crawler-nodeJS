import * as Minio from "minio";
import type { Client } from "minio";
import * as dotenv from "dotenv";
dotenv.config();

export const minio: Client = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});

export const bucketName: string = process.env.BUCKET_NAME;
