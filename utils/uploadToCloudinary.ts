import { UploadApiOptions } from "cloudinary";
import cloudinary from "../configs/cloudinary.config";

const uploadToCloudinary = (options: UploadApiOptions, buffer: Buffer) => {
  return new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(buffer);
  });
};

export default uploadToCloudinary;
