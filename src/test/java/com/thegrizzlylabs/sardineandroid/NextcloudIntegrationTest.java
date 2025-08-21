package com.thegrizzlylabs.sardineandroid;

import org.junit.After;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;

import static org.junit.Assert.*;

/**
 * Integration tests that work with your Nextcloud server.
 * These tests create and clean up their own test files.
 */
public class NextcloudIntegrationTest extends BaseNextcloudTest {

    @Test
    public void testBasicOperations() throws IOException {
        String fileName = "test-basic-" + UUID.randomUUID().toString() + ".txt";
        String testUrl = getTestUrl(fileName);
        
        try {
            // Test file doesn't exist initially
            assertFalse("File should not exist initially", sardine.exists(testUrl));
            
            // Upload a test file
            byte[] testData = "Hello Nextcloud from Sardine!".getBytes("UTF-8");
            sardine.put(testUrl, testData, "text/plain", null);
            
            // Test file exists now
            assertTrue("File should exist after upload", sardine.exists(testUrl));
            
            // Download and verify content
            InputStream inputStream = sardine.get(testUrl);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                output.write(buffer, 0, bytesRead);
            }
            inputStream.close();
            
            String downloadedContent = output.toString("UTF-8");
            assertEquals("Downloaded content should match uploaded content", 
                        "Hello Nextcloud from Sardine!", downloadedContent);
            
        } finally {
            cleanupTestFile(fileName);
        }
    }
    
    @Test
    public void testDirectoryOperations() throws IOException {
        String dirName = "test-dir-" + UUID.randomUUID().toString() + "/";
        String testDirUrl = getTestUrl(dirName);
        
        try {
            // Create directory
            sardine.createDirectory(testDirUrl);
            assertTrue("Directory should exist after creation", sardine.exists(testDirUrl));
            
            // List parent directory to see if our directory appears
            List<DavResource> resources = sardine.list(webdavBaseUrl);
            boolean found = resources.stream()
                .anyMatch(r -> r.getName().equals(dirName.substring(0, dirName.length()-1)) && r.isDirectory());
            assertTrue("Created directory should appear in listing", found);
            
        } finally {
            // Clean up directory
            try {
                if (sardine.exists(testDirUrl)) {
                    sardine.delete(testDirUrl);
                }
            } catch (Exception e) {
                // Ignore cleanup errors
            }
        }
    }
    
    @Test
    public void testFileInDirectory() throws IOException {
        String dirName = "test-dir-" + UUID.randomUUID().toString() + "/";
        String fileName = "test-file.txt";
        String testDirUrl = getTestUrl(dirName);
        String testFileUrl = getTestUrl(dirName + fileName);
        
        try {
            // Create directory
            sardine.createDirectory(testDirUrl);
            
            // Create file in directory
            byte[] testData = "File in subdirectory".getBytes("UTF-8");
            sardine.put(testFileUrl, testData, "text/plain", null);
            
            // Verify file exists
            assertTrue("File should exist in subdirectory", sardine.exists(testFileUrl));
            
            // List directory contents
            List<DavResource> resources = sardine.list(testDirUrl);
            boolean found = resources.stream()
                .anyMatch(r -> r.getName().equals(fileName) && !r.isDirectory());
            assertTrue("File should appear in directory listing", found);
            
        } finally {
            // Clean up file and directory
            try {
                if (sardine.exists(testFileUrl)) {
                    sardine.delete(testFileUrl);
                }
                if (sardine.exists(testDirUrl)) {
                    sardine.delete(testDirUrl);
                }
            } catch (Exception e) {
                // Ignore cleanup errors
            }
        }
    }
    
    @Test
    public void testLargerFile() throws IOException {
        String fileName = "test-large-" + UUID.randomUUID().toString() + ".txt";
        String testUrl = getTestUrl(fileName);
        
        try {
            // Create a larger test file (10KB)
            StringBuilder content = new StringBuilder();
            for (int i = 0; i < 1000; i++) {
                content.append("Line ").append(i).append(" - This is test data for Sardine WebDAV client.\\n");
            }
            byte[] testData = content.toString().getBytes("UTF-8");
            
            // Upload the file
            sardine.put(testUrl, testData, "text/plain", null);
            
            // Verify it exists
            assertTrue("Large file should exist after upload", sardine.exists(testUrl));
            
            // Get file info and check size
            List<DavResource> resources = sardine.list(webdavBaseUrl);
            DavResource uploadedFile = resources.stream()
                .filter(r -> r.getName().equals(fileName))
                .findFirst()
                .orElse(null);
            
            assertNotNull("Uploaded file should be in listing", uploadedFile);
            assertEquals("File size should match", testData.length, uploadedFile.getContentLength().longValue());
            
        } finally {
            cleanupTestFile(fileName);
        }
    }
    
    @After
    public void tearDown() {
        // Additional cleanup if needed
    }
}