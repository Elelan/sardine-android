package com.thegrizzlylabs.sardineandroid;

import com.thegrizzlylabs.sardineandroid.impl.OkHttpSardine;
import org.junit.Before;
import org.junit.BeforeClass;

/**
 * Base class for Nextcloud integration tests.
 * Uses environment variables or system properties for configuration.
 */
public abstract class BaseNextcloudTest {
    
    protected static String nextcloudUrl;
    protected static String username;
    protected static String password;
    protected static String webdavBaseUrl;
    
    protected Sardine sardine;
    
    @BeforeClass
    public static void setUpClass() {
        // Try to load from properties file first
        java.util.Properties props = new java.util.Properties();
        try {
            java.io.InputStream propStream = BaseNextcloudTest.class.getClassLoader()
                .getResourceAsStream("test-config.properties");
            if (propStream != null) {
                props.load(propStream);
                nextcloudUrl = props.getProperty("nextcloud.url");
                username = props.getProperty("nextcloud.username");
                password = props.getProperty("nextcloud.password");
                propStream.close();
            }
        } catch (Exception e) {
            // Properties file not found, try other methods
        }
        
        // If not found in properties file, try system properties
        if (nextcloudUrl == null) nextcloudUrl = System.getProperty("nextcloud.url");
        if (username == null) username = System.getProperty("nextcloud.username");
        if (password == null) password = System.getProperty("nextcloud.password");
        
        // If not found in system properties, try environment variables
        if (nextcloudUrl == null) nextcloudUrl = System.getenv("NEXTCLOUD_URL");
        if (username == null) username = System.getenv("NEXTCLOUD_USERNAME");
        if (password == null) password = System.getenv("NEXTCLOUD_PASSWORD");
        
        if (nextcloudUrl != null && username != null) {
            // Construct WebDAV URL - different for Nextcloud vs simple WebDAV servers
            if (nextcloudUrl.contains("localhost")) {
                // Simple WebDAV server (local)
                webdavBaseUrl = nextcloudUrl + "/sardine-test/";
            } else {
                // Nextcloud server
                webdavBaseUrl = nextcloudUrl + "/remote.php/dav/files/" + username + "/sardine-test/";
            }
        }
    }
    
    @Before
    public void setUp() throws Exception {
        // Skip tests if credentials are not provided
        org.junit.Assume.assumeNotNull("Nextcloud URL not provided", nextcloudUrl);
        org.junit.Assume.assumeNotNull("Nextcloud username not provided", username);
        org.junit.Assume.assumeNotNull("Nextcloud password not provided", password);
        
        sardine = new OkHttpSardine();
        sardine.setCredentials(username, password);
        
        // Create test directory if it doesn't exist
        try {
            if (!sardine.exists(webdavBaseUrl)) {
                sardine.createDirectory(webdavBaseUrl);
            }
        } catch (Exception e) {
            // Directory might already exist, that's ok
        }
    }
    
    /**
     * Get a test URL under the sardine-test directory
     */
    protected String getTestUrl(String fileName) {
        return webdavBaseUrl + fileName;
    }
    
    /**
     * Clean up test file if it exists
     */
    protected void cleanupTestFile(String fileName) {
        try {
            String url = getTestUrl(fileName);
            if (sardine.exists(url)) {
                sardine.delete(url);
            }
        } catch (Exception e) {
            // Ignore cleanup errors
        }
    }
}