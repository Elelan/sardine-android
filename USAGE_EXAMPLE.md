# How to Use Sardine-Android with Nextcloud

This WebDAV library allows you to connect to Nextcloud from your Android app and upload/download files.

## Setup in Your Android Project

### Option 1: Using JitPack (Recommended)

1. Add JitPack repository to your project's `build.gradle`:
```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://jitpack.io' }
    }
}
```

2. Add the dependency to your app's `build.gradle`:
```gradle
dependencies {
    implementation("com.github.elelan:sardine-android:0.1.0-alpha05")
}
```

### Option 2: As a Git Submodule

1. Add as submodule: `git submodule add https://github.com/yourusername/sardine-android.git`
2. Include in `settings.gradle`: `include ':sardine-android'`
3. Add dependency: `implementation project(':sardine-android')`

## Basic Usage

### 1. Initialize Sardine Client

```java
import com.thegrizzlylabs.sardineandroid.Sardine;
import com.thegrizzlylabs.sardineandroid.impl.OkHttpSardine;

// Create client
Sardine sardine = new OkHttpSardine();

// Set credentials (use app passwords for better security)
sardine.setCredentials("username", "app-password");
```

### 2. Nextcloud WebDAV URLs

Nextcloud WebDAV endpoint format:
- Base URL: `https://your-nextcloud.com/remote.php/dav/files/USERNAME/`
- File URL: `https://your-nextcloud.com/remote.php/dav/files/USERNAME/path/to/file.txt`

### 3. Upload a File

```java
String nextcloudUrl = "https://your-nextcloud.com";
String username = "your-username";
String webdavBase = nextcloudUrl + "/remote.php/dav/files/" + username + "/";

// Upload from File object
File file = new File("/path/to/local/file.txt");
sardine.put(webdavBase + "uploaded-file.txt", file, "text/plain", null);

// Upload from byte array
byte[] data = "Hello Nextcloud!".getBytes("UTF-8");
sardine.put(webdavBase + "hello.txt", data, "text/plain", null);

// Upload with SardineListener for progress tracking
SardineListener listener = new SardineListener() {
    @Override
    public void transferred(long bytes) {
        System.out.println("Uploaded: " + bytes + " bytes");
    }
};
sardine.put(webdavBase + "with-progress.txt", data, "text/plain", listener);
```

### 4. Download a File

```java
String fileUrl = webdavBase + "file.txt";

// Download to InputStream
InputStream inputStream = sardine.get(fileUrl);

// Read content
ByteArrayOutputStream output = new ByteArrayOutputStream();
byte[] buffer = new byte[1024];
int bytesRead;
while ((bytesRead = inputStream.read(buffer)) != -1) {
    output.write(buffer, 0, bytesRead);
}
String content = output.toString("UTF-8");
```

### 5. List Directory Contents

```java
List<DavResource> resources = sardine.list(webdavBase);
for (DavResource resource : resources) {
    System.out.println("Name: " + resource.getName());
    System.out.println("Is Directory: " + resource.isDirectory());
    System.out.println("Size: " + resource.getContentLength());
    System.out.println("Modified: " + resource.getModified());
}
```

### 6. Check if File Exists

```java
boolean exists = sardine.exists(webdavBase + "file.txt");
```

### 7. Create Directory

```java
sardine.createDirectory(webdavBase + "new-folder/");
```

### 8. Delete File or Directory

```java
sardine.delete(webdavBase + "file.txt");
sardine.delete(webdavBase + "folder/");
```

## Android Permissions

Add internet permission to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## Best Practices

1. **Use App Passwords**: Create app-specific passwords in Nextcloud instead of using your main password
2. **Background Thread**: Always perform WebDAV operations on background threads
3. **Error Handling**: Wrap operations in try-catch blocks for proper error handling
4. **HTTPS**: Always use HTTPS for security
5. **Connection Pooling**: Reuse the same Sardine instance when possible

## Example Android Integration

```java
public class NextcloudUploader {
    private Sardine sardine;
    private String baseUrl;
    
    public NextcloudUploader(String serverUrl, String username, String password) {
        sardine = new OkHttpSardine();
        sardine.setCredentials(username, password);
        baseUrl = serverUrl + "/remote.php/dav/files/" + username + "/";
    }
    
    public void uploadFileAsync(File file, String remotePath, Callback callback) {
        new AsyncTask<Void, Void, Boolean>() {
            @Override
            protected Boolean doInBackground(Void... voids) {
                try {
                    FileInputStream inputStream = new FileInputStream(file);
                    sardine.put(baseUrl + remotePath, inputStream, "application/octet-stream");
                    return true;
                } catch (Exception e) {
                    e.printStackTrace();
                    return false;
                }
            }
            
            @Override
            protected void onPostExecute(Boolean success) {
                callback.onComplete(success);
            }
        }.execute();
    }
    
    interface Callback {
        void onComplete(boolean success);
    }
}
```

## Testing the Library

Run the unit tests to verify everything works:
```bash
./gradlew test
```

The `NextcloudTest.java` file shows practical examples of all operations.
