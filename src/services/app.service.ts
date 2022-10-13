import { storage } from "../firebase-config";


class AppService {
  public static async getHello(): Promise<string> {
    return "Hello World! from AppService";
  }
  public static async dracoCompression(): Promise<string> {
    return "Hello World! from AppService";
  }

  public static async getStorageBucketFile(fileName: string): Promise<any> {
    const bucket = storage.bucket("draco-compression.appspot.com");
    const file = bucket.file(fileName);
    const fileExists = await file.exists();
    if (fileExists[0]) {
      const fileData = await file.download();
      return fileData[0];
    }
  }
 

  public static async uploadFileToStorageBucket(
    fileName: string,
    fileData: Buffer
  ): Promise<void> {
    const bucket = storage.bucket("draco-converter.appspot.com");
    const file = bucket.file(fileName);
    const fileExists = await file.exists();
    if (fileExists[0]) {
      await file.delete();
    }
    try {
      await file.save(fileData);
      // return the location of saved file
    } catch (err) {
      throw new Error(err);
    }
  }
}

export default AppService;
