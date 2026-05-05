import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

// Initialize Cloudinary with environment variables
cloudinary.config({
	cloud_name: env.CLOUDINARY_CLOUD_NAME,
	api_key: env.CLOUDINARY_API_KEY,
	api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file buffer to Cloudinary
 * @param buffer The file buffer to upload
 * @param folder The folder in Cloudinary to store the image
 * @returns Promise resolving to the secure URL of the uploaded image
 */
export const uploadImageToCloudinary = async (
	buffer: Buffer,
	folder = "products",
): Promise<string> => {
	return new Promise((resolve, reject) => {
		const uploadStream = cloudinary.uploader.upload_stream(
			{
				folder,
				resource_type: "auto",
			},
			(error, result) => {
				if (error) {
					console.error("Cloudinary upload error:", error);
					reject(new Error("Gagal mengupload gambar ke server"));
				} else if (result) {
					resolve(result.secure_url);
				} else {
					reject(new Error("Respon tidak valid dari server gambar"));
				}
			},
		);

		uploadStream.end(buffer);
	});
};

/**
 * Deletes an image from Cloudinary by its public ID
 * @param publicId The public ID of the image to delete
 */
export const deleteImageFromCloudinary = async (
	publicId: string,
): Promise<void> => {
	try {
		await cloudinary.uploader.destroy(publicId);
	} catch (error) {
		console.error("Error deleting image from Cloudinary:", error);
		// Don't throw, just log to prevent failure of the main operation
	}
};

/**
 * Extracts the public ID from a Cloudinary URL
 * @param url The full Cloudinary URL
 * @returns The public ID
 */
export const extractPublicId = (url: string): string | null => {
	try {
		// URLs typically look like: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
		const parts = url.split("/");
		const filename = parts.pop();
		const folder = parts.pop();

		if (!filename) return null;

		const publicIdWithExtension = `${folder}/${filename}`;
		// Remove file extension
		return publicIdWithExtension.replace(/\.[^/.]+$/, "");
	} catch (_error) {
		return null;
	}
};
