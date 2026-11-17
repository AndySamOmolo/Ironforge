package com.ironforge.workout;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
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
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
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
                return windowInsets;
            });
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setKeepScreenOn(true);
            webView.setBackgroundColor(Color.parseColor("#070710"));
            webView.addJavascriptInterface(new IronForgeNativeBridge(), "IronForgeNative");
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    public class IronForgeNativeBridge {
        @JavascriptInterface
        public void setKeepScreenOn(final boolean enabled) {
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
        public boolean exportBackupJson(final String filename, final String jsonContent) {
            try {
                String safeName = (filename != null && !filename.trim().isEmpty())
                    ? filename.trim().replaceAll("[^a-zA-Z0-9._-]", "_")
                    : "ironforge-backup.json";
                File outFile = new File(getCacheDir(), safeName);
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
                try {
                    Intent textShare = new Intent(Intent.ACTION_SEND);
                    textShare.setType("text/plain");
                    textShare.putExtra(Intent.EXTRA_SUBJECT, filename != null ? filename : "ironforge-backup.json");
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
        }
    }
}
