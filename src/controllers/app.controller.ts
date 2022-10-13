import * as express from "express";
import { HTTP_CODES } from "../http-codes";
import AppService from "../services/app.service";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
//@ts-ignore
import { db, storage } from "../firebase-config";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.get("/", async (req, res) => {
  let response = await AppService.getHello();
  res.status(HTTP_CODES.OK).send(response);
});

router.post("/upload-model", async (req, res) => {
  const Busboy = require("busboy");
  const busboy = Busboy({ headers: req.headers });
  const generatedToken = uuidv4();
  let meshFileName: string;
  let fileToBeUploaded: any;
  busboy.on(
    "file",
    // @ts-ignore
    async (name, file, info) => {
      console.log("mimeType", info);
      const fileExtension = info.filename.split(".").pop();

      if (info.mimeType !== "application/octet-stream") {
        return res.status(HTTP_CODES.BAD_REQUEST).json({
          error: `Wrong file type submitted. Expected application/octet-stream, got ${info.mimeType} `,
        });
      }
      if (fileExtension !== "gltf" && fileExtension !== "glb") {
        return res
          .status(HTTP_CODES.BAD_REQUEST)
          .json({ error: "Wrong file type submitted" });
      }

      meshFileName = `${Math.round(
        Math.random() * 10000000000
      ).toString()}.${fileExtension}`;
      const filepath = path.join(os.tmpdir(), meshFileName);
      fileToBeUploaded = { filepath, mimeType: info.mimeType };
      // write the file into filepath
      file.pipe(fs.createWriteStream(filepath));
    }
  );
  busboy.on("finish", async () => {
    console.log("yoooo");
    const filepath = path.join(os.tmpdir(), meshFileName);
    storage
      .bucket("draco-converter.appspot.com")
      .upload(filepath, {
        metadata: {
          metadata: {
            contentType: fileToBeUploaded.mimeType,
            firebaseStorageDownloadTokens: generatedToken,
          },
        },
      })
      .then(() => {
         db.collection("compression-jobs").add({
          meshFileName,
          meshFileToken: generatedToken,
        }); 
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/draco-converter.appspot.com/o/compressed%2F${meshFileName}?alt=media&token=${generatedToken}`
        return res
          .status(HTTP_CODES.OK)
          .json({ fileUrl, fileName: meshFileName });
      })
      .catch((err) => {
        return res
          .status(HTTP_CODES.INTERNAL_SERVER_ERROR)
          .json({ error: err });
      });
  });
  req.pipe(busboy);
});

router.post("/download-model", async (req, res) => {
  const { fileName } = req.body;
  try {
    const fileData = await AppService.getStorageBucketFile(fileName);
    res.status(HTTP_CODES.OK).send(fileData);
  } catch (err) {
    res.status(HTTP_CODES.INTERNAL_SERVER_ERROR).send(err.message);
    console.log(err);
  }
});

export default router;
