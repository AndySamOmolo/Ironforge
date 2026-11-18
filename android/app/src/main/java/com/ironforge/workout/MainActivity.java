package com.ironforge.workout;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    private static final String NOTIFICATION_CHANNEL_ID = "ironforge_reminders";
    private static final String NOTIFICATION_CHANNEL_NAME = "Workout Reminders";
    private static final int REQUEST_POST_NOTIFICATIONS = 1001;
    private static final int MAX_BACKUP_JSON_LENGTH = 25_000_000;

    private boolean keepScreenOnEnabled = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#070710"));
        window.setNavigationBarColor(Color.parseColor("#070710"));

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        // Ensure Android 15/16 (targetSdk 36) edge-to-edge system bars never overlap the WebView content
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#070710"));
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
        }

        createNotificationChannel();
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        REQUEST_POST_NOTIFICATIONS
                );
            }
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setKeepScreenOn(false);
            webView.setBackgroundColor(Color.parseColor("#070710"));
            webView.addJavascriptInterface(new IronForgeNativeBridge(), "IronForgeNative");
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                        NOTIFICATION_CHANNEL_ID,
                        NOTIFICATION_CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Workout rest timer and training alerts");
                channel.enableVibration(true);
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (keepScreenOnEnabled) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
    }

    public class IronForgeNativeBridge {
        @JavascriptInterface
        public void setKeepScreenOn(final boolean enabled) {
            keepScreenOnEnabled = enabled;
            runOnUiThread(() -> {
                if (enabled) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().setKeepScreenOn(enabled);
                }
            });
        }

        @JavascriptInterface
        public void clearCachedBackups() {
            File backupsDir = new File(getCacheDir(), "backups");
            if (backupsDir.exists() && backupsDir.isDirectory()) {
                File[] existingFiles = backupsDir.listFiles();
                if (existingFiles != null) {
                    for (File file : existingFiles) {
                        if (file != null && file.isFile()) {
                            //noinspection ResultOfMethodCallIgnored
                            file.delete();
                        }
                    }
                }
            }
        }

        @JavascriptInterface
        public boolean showNotification(final String title, final String body) {
            try {
                createNotificationChannel();
                if (Build.VERSION.SDK_INT >= 33) {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                            != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(
                                MainActivity.this,
                                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                                REQUEST_POST_NOTIFICATIONS
                        );
                        return false;
                    }
                }
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager == null) return false;

                String safeTitle = (title != null && !title.trim().isEmpty()) ? title.trim() : "IronForge";
                String safeBody = (body != null) ? body.trim() : "";

                Intent launchIntent = new Intent(MainActivity.this, MainActivity.class);
                launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                        MainActivity.this,
                        0,
                        launchIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, NOTIFICATION_CHANNEL_ID)
                        .setSmallIcon(getApplicationInfo().icon)
                        .setContentTitle(safeTitle)
                        .setContentText(safeBody)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent);

                manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean exportBackupJson(final String filename, final String jsonContent) {
            if (jsonContent == null || jsonContent.length() > MAX_BACKUP_JSON_LENGTH) return false;
            String candidate = (filename != null && !filename.trim().isEmpty())
                ? filename.trim().replaceAll("[^a-zA-Z0-9._-]", "_")
                : "ironforge-backup.json";
            if (candidate.isEmpty() || ".".equals(candidate) || "..".equals(candidate)) {
                candidate = "ironforge-backup.json";
            }
            final String safeName = candidate;
            try {
                File backupsDir = new File(getCacheDir(), "backups");
                if (!backupsDir.exists()) {
                    backupsDir.mkdirs();
                } else {
                    File[] existingFiles = backupsDir.listFiles();
                    if (existingFiles != null) {
                        for (File existing : existingFiles) {
                            if (existing != null && existing.isFile()) {
                                //noinspection ResultOfMethodCallIgnored
                                existing.delete();
                            }
                        }
                    }
                }
                File outFile = new File(backupsDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }
                Uri contentUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getApplicationContext().getPackageName() + ".fileprovider",
                    outFile
                );
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("application/json");
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, safeName);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> {
                    Intent chooser = Intent.createChooser(shareIntent, "Export IronForge Backup");
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(chooser);
                });
                return true;
            } catch (Exception e) {
                // Only fall back to EXTRA_TEXT if payload is safely below Android Binder 1MB limit
                if (jsonContent.length() < 200000) {
                    try {
                        Intent textShare = new Intent(Intent.ACTION_SEND);
                        textShare.setType("text/plain");
                        textShare.putExtra(Intent.EXTRA_SUBJECT, safeName);
                        textShare.putExtra(Intent.EXTRA_TEXT, jsonContent);
                        runOnUiThread(() -> {
                            Intent chooser = Intent.createChooser(textShare, "Export IronForge Backup");
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(chooser);
                        });
                        return true;
                    } catch (Exception ignored) {
                        return false;
                    }
                }
                return false;
            }
        }
    }
}
