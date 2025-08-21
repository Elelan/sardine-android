# Local WebDAV Test Server

This directory contains a simple Node.js WebDAV server for testing Sardine Android library locally.

## Setup

1. **Install Node.js** (if not already installed):
   - Download from https://nodejs.org/
   - Or use your package manager (brew, apt, etc.)

2. **Start the WebDAV server**:
   ```bash
   ./start-webdav.sh
   ```

3. **Run tests**:
   ```bash
   # From the project root
   ./gradlew test
   ```

## Server Details

- **URL**: http://localhost:8080
- **Username**: testuser
- **Password**: testpass
- **Root Directory**: `./webdav-root` (created automatically)

## Supported WebDAV Methods

- GET, PUT, DELETE
- PROPFIND (with depth support)
- MKCOL (create directories)
- LOCK/UNLOCK (basic implementation)
- OPTIONS

## Configuration

The test configuration is automatically set in:
- `src/test/resources/test-config.properties`
- `test-config.properties`

Both files are configured to use the local server by default.

## Troubleshooting

1. **Port 8080 already in use**:
   - Change the port in `server.js` (line with `new WebDAVServer(8080, ...)`)
   - Update the URL in the properties files

2. **Node.js not found**:
   - Install Node.js from https://nodejs.org/

3. **Permission errors**:
   - Make sure the script is executable: `chmod +x start-webdav.sh`