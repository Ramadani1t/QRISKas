package id.qriskas.mobile

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Helper untuk mengelola permission kamera dan storage Android 13.
 */
object CameraPermissionHelper {

    private const val CAMERA_PERMISSION = Manifest.permission.CAMERA
    private const val READ_MEDIA_IMAGES = Manifest.permission.READ_MEDIA_IMAGES
    private const val READ_EXTERNAL_STORAGE = Manifest.permission.READ_EXTERNAL_STORAGE

    const val REQUEST_CODE_CAMERA = 1001
    const val REQUEST_CODE_STORAGE = 1002
    const val REQUEST_CODE_ALL = 1003

    fun hasCameraPermission(activity: Activity): Boolean {
        return ContextCompat.checkSelfPermission(activity, CAMERA_PERMISSION) == PackageManager.PERMISSION_GRANTED
    }

    fun hasStoragePermission(activity: Activity): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(activity, READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(activity, READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }
    }

    fun requestCameraPermission(activity: Activity) {
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(CAMERA_PERMISSION),
            REQUEST_CODE_CAMERA
        )
    }

    fun requestAllPermissions(activity: Activity) {
        val permissions = mutableListOf(CAMERA_PERMISSION)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            permissions.add(READ_MEDIA_IMAGES)
        } else {
            permissions.add(READ_EXTERNAL_STORAGE)
        }
        ActivityCompat.requestPermissions(
            activity,
            permissions.toTypedArray(),
            REQUEST_CODE_ALL
        )
    }
}
