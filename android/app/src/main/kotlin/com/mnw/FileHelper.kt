package com.mnw

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import java.io.OutputStream
import java.io.OutputStreamWriter

/**
 * FileHelper inspired by Markor architecture for Scoped Storage (API 29+)
 */
object FileHelper {

    /**
     * Saves a text file to the Downloads folder using MediaStore.
     * Compatible with Android 10+ (Scoped Storage) and Android 13+ (API 33).
     */
    fun saveTextFileToDownloads(
        context: Context,
        fileName: String,
        content: String
    ): Result<Uri> {
        return try {
            val resolver = context.contentResolver
            
            // Prepare file metadata
            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, if (fileName.endsWith(".txt")) fileName else "$fileName.txt")
                put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+ specific: Relative path in Downloads
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/MNW_Notes")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            }

            // Insert into MediaStore
            val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                MediaStore.Downloads.EXTERNAL_CONTENT_URI
            } else {
                // For older versions, though the request specifies API 33+
                MediaStore.Files.getContentUri("external")
            }

            val uri = resolver.insert(collection, contentValues) 
                ?: throw Exception("Failed to create MediaStore entry")

            // Write content
            resolver.openOutputStream(uri)?.use { outputStream: OutputStream ->
                OutputStreamWriter(outputStream).use { writer ->
                    writer.write(content)
                }
            } ?: throw Exception("Failed to open output stream")

            // Mark as no longer pending (Android 10+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)
            }

            Result.success(uri)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
