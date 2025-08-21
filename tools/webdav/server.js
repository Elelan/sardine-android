const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const fsPromises = require('fs').promises;
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipe = promisify(pipeline);

class WebDAVServer {
    constructor(port = 8080, rootDir = './webdav-root') {
        this.port = port;
        this.rootDir = path.resolve(rootDir);
        this.users = {
            'testuser': 'testpass'
        };
        
        // Ensure root directory exists
        if (!fs.existsSync(this.rootDir)) {
            fs.mkdirSync(this.rootDir, { recursive: true });
        }
    }

    authenticate(req) {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Basic ')) {
            return false;
        }
        
        const credentials = Buffer.from(auth.slice(6), 'base64').toString();
        const [username, password] = credentials.split(':');
        
        return this.users[username] === password;
    }

    getFilePath(urlPath) {
        const decodedPath = decodeURIComponent(urlPath);
        const safePath = path.normalize(decodedPath).replace(/^\/+/, '');
        return path.join(this.rootDir, safePath);
    }

    getDestinationPath(req) {
        const dest = req.headers.destination;
        if (!dest) return null;
        const destPathname = url.parse(dest).pathname; // e.g. /sardine-test/foo.txt
        return this.getFilePath(destPathname);
    }

    sendXMLResponse(res, statusCode, xml) {
        res.writeHead(statusCode, {
            'Content-Type': 'application/xml; charset=utf-8',
            'DAV': '1, 2'
        });
        res.end(xml);
    }

    sendResponse(res, statusCode, data = '', contentType = 'text/plain') {
        res.writeHead(statusCode, {
            'Content-Type': contentType,
            'DAV': '1, 2'
        });
        res.end(data);
    }

    handleOptions(req, res) {
        res.writeHead(200, {
            'DAV': '1, 2',
            'Allow': 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK'
        });
        res.end();
    }

    async handlePropfind(req, res, filePath) {
        try {
            const stats = fs.statSync(filePath);
            const isDirectory = stats.isDirectory();
            const urlPath = url.parse(req.url).pathname;
            
            let xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
    <D:response>
        <D:href>${urlPath}</D:href>
        <D:propstat>
            <D:prop>
                <D:resourcetype>${isDirectory ? '<D:collection/>' : ''}</D:resourcetype>
                <D:getcontentlength>${isDirectory ? 0 : stats.size}</D:getcontentlength>
                <D:getlastmodified>${stats.mtime.toUTCString()}</D:getlastmodified>
                <D:creationdate>${stats.birthtime.toISOString()}</D:creationdate>
                <D:getetag>"${stats.mtime.getTime()}-${stats.size}"</D:getetag>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>`;

            // If directory and depth > 0, list children
            const depth = req.headers.depth || '1';
            if (isDirectory && depth !== '0') {
                try {
                    const files = fs.readdirSync(filePath);
                    for (const file of files) {
                        const childPath = path.join(filePath, file);
                        const childStats = fs.statSync(childPath);
                        const childUrlPath = urlPath.endsWith('/') ? urlPath + file : urlPath + '/' + file;
                        
                        xml += `
    <D:response>
        <D:href>${childUrlPath}</D:href>
        <D:propstat>
            <D:prop>
                <D:resourcetype>${childStats.isDirectory() ? '<D:collection/>' : ''}</D:resourcetype>
                <D:getcontentlength>${childStats.isDirectory() ? 0 : childStats.size}</D:getcontentlength>
                <D:getlastmodified>${childStats.mtime.toUTCString()}</D:getlastmodified>
                <D:creationdate>${childStats.birthtime.toISOString()}</D:creationdate>
                <D:getetag>"${childStats.mtime.getTime()}-${childStats.size}"</D:getetag>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>`;
                    }
                } catch (err) {
                    console.error('Error reading directory:', err);
                }
            }

            xml += '\n</D:multistatus>';
            this.sendXMLResponse(res, 207, xml);
        } catch (err) {
            this.sendResponse(res, 404, 'Not Found');
        }
    }

    handleGet(req, res, filePath) {
        try {
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                const stream = fs.createReadStream(filePath);
                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': stats.size,
                    'Last-Modified': stats.mtime.toUTCString(),
                    'ETag': `"${stats.mtime.getTime()}-${stats.size}"`
                });
                stream.pipe(res);
            } else {
                this.sendResponse(res, 405, 'Method Not Allowed');
            }
        } catch (err) {
            this.sendResponse(res, 404, 'Not Found');
        }
    }

    handlePut(req, res, filePath) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const writeStream = fs.createWriteStream(filePath);
            req.pipe(writeStream);

            writeStream.on('finish', () => {
                this.sendResponse(res, 201, 'Created');
            });

            writeStream.on('error', (err) => {
                console.error('Error writing file:', err);
                this.sendResponse(res, 500, 'Internal Server Error');
            });
        } catch (err) {
            console.error('Error in PUT:', err);
            this.sendResponse(res, 500, 'Internal Server Error');
        }
    }

    handleDelete(req, res, filePath) {
        try {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(filePath);
            }
            this.sendResponse(res, 204, '');
        } catch (err) {
            this.sendResponse(res, 404, 'Not Found');
        }
    }

    handleMkcol(req, res, filePath) {
        try {
            fs.mkdirSync(filePath, { recursive: true });
            this.sendResponse(res, 201, 'Created');
        } catch (err) {
            if (err.code === 'EEXIST') {
                this.sendResponse(res, 405, 'Method Not Allowed');
            } else {
                this.sendResponse(res, 500, 'Internal Server Error');
            }
        }
    }

    async copyRecursive(src, dest) {
        const stat = await fsPromises.stat(src);
        if (stat.isDirectory()) {
            await fsPromises.mkdir(dest, { recursive: true });
            const entries = await fsPromises.readdir(src);
            for (const e of entries) {
                await this.copyRecursive(path.join(src, e), path.join(dest, e));
            }
        } else {
            await fsPromises.mkdir(path.dirname(dest), { recursive: true });
            await pipe(fs.createReadStream(src), fs.createWriteStream(dest));
        }
    }

    async handleMove(req, res, srcPath) {
        const destPath = this.getDestinationPath(req);
        if (!destPath) return this.sendResponse(res, 400, 'Bad Request: Destination header missing');

        const overwrite = (req.headers.overwrite || 'T').toUpperCase() === 'T';
        const srcExists = fs.existsSync(srcPath);
        if (!srcExists) return this.sendResponse(res, 404, 'Not Found');

        const destExists = fs.existsSync(destPath);
        if (destExists && !overwrite) return this.sendResponse(res, 412, 'Precondition Failed');

        try {
            await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
            try {
                await fsPromises.rename(srcPath, destPath);
            } catch (e) {
                // cross-device or other rename failures: fallback to copy+delete
                await this.copyRecursive(srcPath, destPath);
                const s = fs.statSync(srcPath);
                if (s.isDirectory()) await fsPromises.rm(srcPath, { recursive: true, force: true });
                else await fsPromises.unlink(srcPath);
            }
            return this.sendResponse(res, destExists ? 204 : 201, '');
        } catch (e) {
            console.error('MOVE error:', e);
            return this.sendResponse(res, 500, 'Internal Server Error');
        }
    }

    async handleCopy(req, res, srcPath) {
        const destPath = this.getDestinationPath(req);
        if (!destPath) return this.sendResponse(res, 400, 'Bad Request: Destination header missing');

        const overwrite = (req.headers.overwrite || 'T').toUpperCase() === 'T';
        const srcExists = fs.existsSync(srcPath);
        if (!srcExists) return this.sendResponse(res, 404, 'Not Found');

        const destExists = fs.existsSync(destPath);
        if (destExists && !overwrite) return this.sendResponse(res, 412, 'Precondition Failed');

        try {
            await this.copyRecursive(srcPath, destPath);
            return this.sendResponse(res, destExists ? 204 : 201, '');
        } catch (e) {
            console.error('COPY error:', e);
            return this.sendResponse(res, 500, 'Internal Server Error');
        }
    }

    handleLock(req, res) {
        // Simple lock implementation - just return a lock token
        const lockToken = `opaquelocktoken:${Date.now()}-${Math.random()}`;
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
    <D:lockdiscovery>
        <D:activelock>
            <D:locktype><D:write/></D:locktype>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:depth>0</D:depth>
            <D:timeout>Second-604800</D:timeout>
            <D:locktoken><D:href>${lockToken}</D:href></D:locktoken>
        </D:activelock>
    </D:lockdiscovery>
</D:prop>`;
        
        res.writeHead(200, {
            'Content-Type': 'application/xml; charset=utf-8',
            'Lock-Token': `<${lockToken}>`
        });
        res.end(xml);
    }

    handleUnlock(req, res) {
        this.sendResponse(res, 204, '');
    }

    handleRequest(req, res) {
        console.log(`${req.method} ${req.url}`);

        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Depth, If, Lock-Token, Timeout');

        if (req.method === 'OPTIONS') {
            return this.handleOptions(req, res);
        }

        if (!this.authenticate(req)) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="WebDAV"' });
            res.end('Unauthorized');
            return;
        }

        const urlPath = url.parse(req.url).pathname;
        const filePath = this.getFilePath(urlPath);

        switch (req.method) {
            case 'PROPFIND':
                this.handlePropfind(req, res, filePath);
                break;
            case 'GET':
            case 'HEAD':
                this.handleGet(req, res, filePath);
                break;
            case 'PUT':
                this.handlePut(req, res, filePath);
                break;
            case 'DELETE':
                this.handleDelete(req, res, filePath);
                break;
            case 'MKCOL':
                this.handleMkcol(req, res, filePath);
                break;
            case 'LOCK':
                this.handleLock(req, res);
                break;
            case 'UNLOCK':
                this.handleUnlock(req, res);
                break;
            case 'MOVE':
                return this.handleMove(req, res, filePath);
            case 'COPY':
                return this.handleCopy(req, res, filePath);
            default:
                this.sendResponse(res, 405, 'Method Not Allowed');
        }
    }

    start() {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        server.listen(this.port, () => {
            console.log(`WebDAV server running on http://localhost:${this.port}`);
            console.log(`Root directory: ${this.rootDir}`);
            console.log('Test credentials: testuser/testpass');
        });

        return server;
    }
}

// Start the server
const server = new WebDAVServer(8080, './webdav-root');
server.start();