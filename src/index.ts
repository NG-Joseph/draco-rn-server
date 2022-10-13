import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import * as cors from "cors";
import * as gltfPipeline from "gltf-pipeline";
import * as fsExtra from "fs-extra";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
// @ts-ignore
export const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
};
var serviceAccount = require("../draco-converter-firebase-adminsdk-mxzhh-fc2778b6ca.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: firebaseConfig.storageBucket,
});

import router from "./controllers/app.controller";
import rawBodySaver from "./middleware/extract-raw-body";
import { db } from "./firebase-config";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ verify: rawBodySaver }));
app.use(cors());
app.use("/api", router);
exports.api = functions.region("europe-west1").https.onRequest(app);
exports.dracoCompress = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .storage.object()
  .onFinalize(async (object) => {
    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(object.name);
    const glbToGltf = gltfPipeline.glbToGltf;
    // draco compress file using gltf-pipeline
    const fileData = await file.download();
    const fileExtension = object.name.split(".").pop();
    const processGltf = gltfPipeline.processGltf;
    const gltf = fileData[0];
    const options = {
      dracoOptions: {
        compressionLevel: 10,
      },
    };
    const tempFilePath = path.join(os.tmpdir(), object.name);
    const tempFile = fs.createWriteStream(tempFilePath);
    tempFile.write(gltf);
    if (fileExtension === "gltf") {
      processGltf(gltf, options).then(async (results) => {
        functions.logger.info("draco compressed gltf", {
          structuredData: true,
        });
        await fsExtra.writeJsonSync(tempFilePath, results.gltf);
      });
    } else {
      glbToGltf(gltf).then(async function (results) {
        processGltf(results.gltf, options).then(async (results) => {
          functions.logger.info("draco compressed glb");
          await fsExtra.writeJsonSync(tempFilePath, results.gltf);
        });
      });
    }
    // upload compressed file to storage bucket
    // get firestore doc where fileName = object.name
    let fileRef = (
      await db
        .collection("compression-jobs")
        .where("meshFileName", "==", object.name)
        .get()
    ).docs[0];

    // We need to get the previously assigned downloadToken and reassign it to the new file so that the user can still download the file from the url which the backend returns.
    let fileDownloadToken = fileRef.data().meshFileToken;
    await bucket
      .upload(tempFilePath, {
        destination: "compressed/" + object.name,
        metadata: {
          metadata: {
            contentType: object.contentType,
            firebaseStorageDownloadTokens: fileDownloadToken,
          },
        },
      })
      .then(async () => {
        await file.delete();
        db.collection("compression-jobs").doc(fileRef.id).delete();
      })
      .catch((err) => {
        functions.logger.error(err);
      });

    // delete original file

    // ...
  });
app.listen(5000);
console.log("listening on port 5000");
// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
