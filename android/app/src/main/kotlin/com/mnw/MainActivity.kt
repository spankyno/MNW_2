package com.mnw

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var selectedDirUri: Uri? = null

    companion object {
        private const val PERMISSION_REQUEST_CODE = 123
        private const val DIR_PICKER_REQUEST_CODE = 456
        private const val FILE_PICKER_REQUEST_CODE = 789
        private const val SAVE_BACKUP_REQUEST_CODE = 101
        private const val MANAGE_STORAGE_REQUEST_CODE = 202
    }

    private var pendingBackupBytes: ByteArray? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        
        // Security: allowFileAccess is only needed for local assets
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.settings.databaseEnabled = true
        
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: ""
                if (url.startsWith("http") && !url.contains("run.app") && !url.contains("supabase")) {
                    // Open external links in browser
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                }
                return false
            }
        }
        
        // Add JS Bridge
        android.util.Log.d("MNW", "Adding AndroidBridge interface")
        webView.addJavascriptInterface(WebAppInterface(), "AndroidBridge")
        
        // Load production URL
        webView.loadUrl("https://misnotasweb.vercel.app/")
        
        setContentView(webView)

        // Handle Back Press with Callback (Android 13+ migration)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        checkPermissions()
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun selectDirectory() {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
            intent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
                Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
            )
            startActivityForResult(intent, DIR_PICKER_REQUEST_CODE)
        }

        @JavascriptInterface
        fun selectFile() {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
            intent.addCategory(Intent.CATEGORY_OPENABLE)
            intent.type = "text/plain"
            intent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            )
            startActivityForResult(intent, FILE_PICKER_REQUEST_CODE)
        }

        @JavascriptInterface
        fun saveSetting(key: String, value: String) {
            android.util.Log.d("MNW", "Saving setting: $key = $value")
            val sharedPref = getSharedPreferences("MNW_Settings", Context.MODE_PRIVATE)
            with(sharedPref.edit()) {
                putString(key, value)
                apply()
            }
        }

        @JavascriptInterface
        fun getSetting(key: String, defaultValue: String): String {
            val sharedPref = getSharedPreferences("MNW_Settings", Context.MODE_PRIVATE)
            val value = sharedPref.getString(key, defaultValue) ?: defaultValue
            android.util.Log.d("MNW", "Getting setting: $key = $value")
            return value
        }

        @JavascriptInterface
        fun listFiles(uriString: String): String {
            android.util.Log.d("MNW", "Listing files for URI: $uriString")
            val uri = Uri.parse(uriString)
            val dir = DocumentFile.fromTreeUri(this@MainActivity, uri)
            val files = JSONArray()
            dir?.listFiles()?.forEach { file ->
                if (file.isFile && file.name?.endsWith(".txt") == true) {
                    val obj = JSONObject()
                    obj.put("name", file.name)
                    obj.put("lastModified", file.lastModified())
                    obj.put("size", file.length())
                    files.put(obj)
                }
            }
            android.util.Log.d("MNW", "Found ${files.length()} files")
            return files.toString()
        }

        @JavascriptInterface
        fun readFile(uriString: String, fileName: String): String {
            android.util.Log.d("MNW", "Reading file: $fileName from $uriString")
            try {
                val uri = Uri.parse(uriString)
                val dir = DocumentFile.fromTreeUri(this@MainActivity, uri)
                val file = dir?.findFile(fileName)
                if (file != null) {
                    val inputStream = contentResolver.openInputStream(file.uri)
                    val reader = BufferedReader(InputStreamReader(inputStream, "UTF-8"))
                    val content = reader.use { it.readText() }
                    return content
                }
            } catch (e: Exception) {
                android.util.Log.e("MNW", "Error reading file", e)
            }
            return ""
        }

        @JavascriptInterface
        fun writeFile(uriString: String, fileName: String, content: String): Boolean {
            android.util.Log.d("MNW", "Writing file: $fileName to $uriString")
            try {
                val uri = Uri.parse(uriString)
                val dir = DocumentFile.fromTreeUri(this@MainActivity, uri)
                var file = dir?.findFile(fileName)
                if (file == null) {
                    // Strip extension for createFile as it's added automatically based on mimeType
                    val displayName = if (fileName.endsWith(".txt")) fileName.substring(0, fileName.length - 4) else fileName
                    file = dir?.createFile("text/plain", displayName)
                }
                if (file != null) {
                    val outputStream = contentResolver.openOutputStream(file.uri, "wt") // "wt" for write-truncate
                    val writer = OutputStreamWriter(outputStream, "UTF-8")
                    writer.use { it.write(content) }
                    android.util.Log.d("MNW", "File written successfully")
                    return true
                }
            } catch (e: Exception) {
                android.util.Log.e("MNW", "Error writing file", e)
            }
            return false
        }

        @JavascriptInterface
        fun deleteFile(uriString: String, fileName: String): Boolean {
            try {
                val uri = Uri.parse(uriString)
                val dir = DocumentFile.fromTreeUri(this@MainActivity, uri)
                val file = dir?.findFile(fileName)
                return file?.delete() ?: false
            } catch (e: Exception) {
                e.printStackTrace()
            }
            return false
        }

        @JavascriptInterface
        fun renameFile(uriString: String, oldFileName: String, newFileName: String): Boolean {
            android.util.Log.d("MNW", "Renaming file: $oldFileName to $newFileName in $uriString")
            try {
                val uri = Uri.parse(uriString)
                val dir = DocumentFile.fromTreeUri(this@MainActivity, uri)
                val file = dir?.findFile(oldFileName)
                if (file != null) {
                    // Strip extension if it's there as DocumentFile.renameTo handles it
                    val newName = if (newFileName.endsWith(".txt")) newFileName.substring(0, newFileName.length - 4) else newFileName
                    return file.renameTo(newName)
                }
            } catch (e: Exception) {
                android.util.Log.e("MNW", "Error renaming file", e)
            }
            return false
        }

        @JavascriptInterface
        fun readFileByUri(uriString: String): String {
            try {
                val uri = Uri.parse(uriString)
                val inputStream = contentResolver.openInputStream(uri)
                val reader = BufferedReader(InputStreamReader(inputStream, "UTF-8"))
                return reader.use { it.readText() }
            } catch (e: Exception) {
                android.util.Log.e("MNW", "Error reading file by URI", e)
            }
            return ""
        }

        @JavascriptInterface
        fun writeFileByUri(uriString: String, content: String): Boolean {
            try {
                val uri = Uri.parse(uriString)
                val outputStream = contentResolver.openOutputStream(uri, "wt")
                val writer = OutputStreamWriter(outputStream, "UTF-8")
                writer.use { it.write(content) }
                return true
            } catch (e: Exception) {
                android.util.Log.e("MNW", "Error writing file by URI", e)
            }
            return false
        }

        @JavascriptInterface
        fun saveBackup(fileName: String, base64Data: String) {
            try {
                val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
                intent.addCategory(Intent.CATEGORY_OPENABLE)
                intent.type = "application/zip"
                intent.putExtra(Intent.EXTRA_TITLE, fileName)
                
                pendingBackupBytes = bytes
                startActivityForResult(intent, SAVE_BACKUP_REQUEST_CODE)
            } catch (e: Exception) {
                android.util.Log.e("MNW", "Error saving backup", e)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode == Activity.RESULT_OK) {
            when (requestCode) {
                DIR_PICKER_REQUEST_CODE -> {
                    val treeUri = data?.data
                    if (treeUri != null) {
                        contentResolver.takePersistableUriPermission(
                            treeUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        )
                        selectedDirUri = treeUri
                        webView.post {
                            webView.evaluateJavascript("window.onDirectorySelected('${treeUri.toString()}')", null)
                        }
                    }
                }
                FILE_PICKER_REQUEST_CODE -> {
                    val fileUri = data?.data
                    if (fileUri != null) {
                        contentResolver.takePersistableUriPermission(
                            fileUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        )
                        val fileName = DocumentFile.fromSingleUri(this, fileUri)?.name ?: "unnamed.txt"
                        webView.post {
                            webView.evaluateJavascript("window.onFileSelected('${fileUri.toString()}', '${fileName}')", null)
                        }
                    }
                }
                SAVE_BACKUP_REQUEST_CODE -> {
                    val uri = data?.data
                    if (uri != null && pendingBackupBytes != null) {
                        try {
                            contentResolver.openOutputStream(uri)?.use { outputStream ->
                                outputStream.write(pendingBackupBytes)
                            }
                            pendingBackupBytes = null
                            webView.post {
                                webView.evaluateJavascript("window.showToast?.('Backup guardado correctamente')", null)
                            }
                        } catch (e: Exception) {
                            android.util.Log.e("MNW", "Error writing backup to URI", e)
                        }
                    }
                }
            }
        }
    }

    private fun checkPermissions() {
        val permissions = mutableListOf<String>()
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (API 30+) needs MANAGE_EXTERNAL_STORAGE for full access
            if (!Environment.isExternalStorageManager()) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                    intent.addCategory("android.intent.category.DEFAULT")
                    intent.data = Uri.parse(String.format("package:%s", applicationContext.packageName))
                    startActivityForResult(intent, MANAGE_STORAGE_REQUEST_CODE)
                } catch (e: Exception) {
                    val intent = Intent()
                    intent.action = Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION
                    startActivityForResult(intent, MANAGE_STORAGE_REQUEST_CODE)
                }
            }
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }

        val toRequest = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (toRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, toRequest.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }
}
