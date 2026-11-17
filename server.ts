import 'dotenv/config';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { createCeoRouter, fsGetDoc, type CeoAuthedRequest } from './server/ceoRouter.ts';

const PORT = 3000;

if (!getAdminApps().length) {
  initializeAdminApp({
    projectId: firebaseConfig.projectId,
  });
}
const adminAuth = getAdminAuth();

const MEDIA_ROOT = path.resolve(process.cwd(), 'media_storage');
const VIDEOS_DIR = path.join(MEDIA_ROOT, 'videos');
const THUMBNAILS_DIR = path.join(MEDIA_ROOT, 'thumbnails');
const AVATARS_DIR = path.join(MEDIA_ROOT, 'avatars');

for (const dir of [VIDEOS_DIR, THUMBNAILS_DIR, AVATARS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

async function verifyBearerToken(
  req: CeoAuthedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.uid = decoded.uid;
    req.userEmail = decoded.email;
    req.emailVerified = Boolean(decoded.email_verified);
    req.authTime = typeof decoded.auth_time === 'number' ? decoded.auth_time : 0;
    req.idToken = idToken;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

async function ensureNotSuspended(
  req: CeoAuthedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  if (!req.uid || !req.idToken) {
    next();
    return;
  }
  try {
    const profile = await fsGetDoc<Record<string, any>>(req.idToken, `users/${req.uid}`);
    if (profile && (profile.accountStatus === 'suspended' || profile.accountStatus === 'deleted')) {
      res.status(403).json({ error: 'Account suspended. Uploads are disabled.' });
      return;
    }
  } catch {
    // Allow if profile read unavailable during initial bootstrap
  }
  next();
}

const sanitizeExt = (originalname: string, fallback: string) => {
  const ext = path.extname(originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return ext || fallback;
};

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
  filename: (_req, file, cb) => {
    const unique = `bp_vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${unique}${sanitizeExt(file.originalname, '.mp4')}`);
  },
});

const imageStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const kind = req.query.kind === 'avatar' ? AVATARS_DIR : THUMBNAILS_DIR;
    cb(null, kind);
  },
  filename: (_req, file, cb) => {
    const unique = `bp_img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${unique}${sanitizeExt(file.originalname, '.jpg')}`);
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov|mkv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported video format. Please upload MP4, WebM, or MOV.'));
    }
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image format. Please upload JPG, PNG, or WebP.'));
    }
  },
});

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '2mb' }));

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'bharatplay', timestamp: new Date().toISOString() });
  });

  // Mount Server-Verified Auth Clearance & Exclusive CEO Command Center APIs
  app.use('/api', createCeoRouter(verifyBearerToken));

  // Scalable Video Upload Endpoint (Verified Non-Suspended Creator)
  app.post('/api/upload/video', verifyBearerToken, ensureNotSuspended, (req, res) => {
    uploadVideo.single('video')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Video upload failed' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No video file provided' });
        return;
      }
      res.json({
        url: `/api/media/videos/${req.file.filename}`,
        filename: req.file.filename,
        size: req.file.size,
      });
    });
  });

  // Thumbnail / Avatar / Banner Image Upload Endpoint
  app.post('/api/upload/image', verifyBearerToken, ensureNotSuspended, (req, res) => {
    uploadImage.single('image')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Image upload failed' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }
      const folder = req.query.kind === 'avatar' ? 'avatars' : 'thumbnails';
      res.json({
        url: `/api/media/${folder}/${req.file.filename}`,
        filename: req.file.filename,
        size: req.file.size,
      });
    });
  });

  // HTTP 206 Partial Content Streaming for Videos & Static Delivery for Images
  app.get('/api/media/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    const allowedFolders: Record<string, string> = {
      videos: VIDEOS_DIR,
      thumbnails: THUMBNAILS_DIR,
      avatars: AVATARS_DIR,
    };

    const baseDir = allowedFolders[folder];
    if (!baseDir) {
      res.status(404).json({ error: 'Media folder not found' });
      return;
    }

    const safeName = path.basename(filename);
    const filePath = path.join(baseDir, safeName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Media file not found' });
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(safeName).toLowerCase();

    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    if (folder === 'videos') {
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1;
        if (isNaN(start) || start >= fileSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
          return;
        }
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        });
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  // Contact Support Form Endpoint
  app.post('/api/contact', (req, res) => {
    const { name, email, topic, message } = req.body || {};
    if (!name || !email || !message) {
      res.status(400).json({ error: 'Name, email, and message are required.' });
      return;
    }
    res.json({
      ok: true,
      ticketId: `BP-${Date.now().toString(36).toUpperCase()}`,
      receivedAt: new Date().toISOString(),
      topic: topic || 'General',
    });
  });

  // Real-Time WebSocket Server for Live Stream Chat, Watch Party Sync, Viewer Presence & Notifications
  const wss = new WebSocketServer({ noServer: true });

  interface ClientMeta {
    ws: WebSocket;
    streamId: string | null;
    partyId: string | null;
    uid: string | null;
  }

  interface WatchPartySyncState {
    videoId: string;
    isPlaying: boolean;
    currentTime: number;
    updatedAt: number;
    actorName?: string;
  }

  const clients = new Set<ClientMeta>();
  const watchPartyStates = new Map<string, WatchPartySyncState>();

  const broadcastToStream = (streamId: string, payload: unknown) => {
    const data = JSON.stringify(payload);
    for (const c of clients) {
      if (c.streamId === streamId && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(data);
      }
    }
  };

  const broadcastToParty = (partyId: string, payload: unknown, excludeWs?: WebSocket) => {
    const data = JSON.stringify(payload);
    for (const c of clients) {
      if (c.partyId === partyId && c.ws !== excludeWs && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(data);
      }
    }
  };

  const broadcastAll = (payload: unknown) => {
    const data = JSON.stringify(payload);
    for (const c of clients) {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(data);
      }
    }
  };

  const getStreamViewerCount = (streamId: string) => {
    let count = 0;
    for (const c of clients) {
      if (c.streamId === streamId && c.ws.readyState === WebSocket.OPEN) {
        count += 1;
      }
    }
    return count;
  };

  const getPartyParticipantCount = (partyId: string) => {
    let count = 0;
    for (const c of clients) {
      if (c.partyId === partyId && c.ws.readyState === WebSocket.OPEN) {
        count += 1;
      }
    }
    return count;
  };

  wss.on('connection', (ws) => {
    const meta: ClientMeta = { ws, streamId: null, partyId: null, uid: null };
    clients.add(meta);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'identify' && typeof msg.uid === 'string') {
          meta.uid = msg.uid;
        } else if (msg.type === 'join_stream' && typeof msg.streamId === 'string') {
          const prev = meta.streamId;
          meta.streamId = msg.streamId;
          if (prev && prev !== msg.streamId) {
            broadcastToStream(prev, {
              type: 'viewer_count',
              streamId: prev,
              count: getStreamViewerCount(prev),
            });
          }
          broadcastToStream(msg.streamId, {
            type: 'viewer_count',
            streamId: msg.streamId,
            count: getStreamViewerCount(msg.streamId),
          });
        } else if (msg.type === 'leave_stream' && meta.streamId) {
          const left = meta.streamId;
          meta.streamId = null;
          broadcastToStream(left, {
            type: 'viewer_count',
            streamId: left,
            count: getStreamViewerCount(left),
          });
        } else if (msg.type === 'chat_message' && msg.streamId && msg.payload) {
          broadcastToStream(msg.streamId, {
            type: 'chat_message',
            streamId: msg.streamId,
            payload: msg.payload,
          });
        } else if (msg.type === 'live_started' && msg.stream) {
          broadcastAll({
            type: 'live_started',
            stream: msg.stream,
          });
        } else if (msg.type === 'join_party' && typeof msg.partyId === 'string') {
          const prevParty = meta.partyId;
          meta.partyId = msg.partyId;
          if (prevParty && prevParty !== msg.partyId) {
            broadcastToParty(prevParty, {
              type: 'party_participants',
              partyId: prevParty,
              count: getPartyParticipantCount(prevParty),
            });
          }
          broadcastToParty(msg.partyId, {
            type: 'party_participants',
            partyId: msg.partyId,
            count: getPartyParticipantCount(msg.partyId),
          });
          const existingState = watchPartyStates.get(msg.partyId);
          if (existingState && ws.readyState === WebSocket.OPEN) {
            const elapsed = existingState.isPlaying
              ? (Date.now() - existingState.updatedAt) / 1000
              : 0;
            ws.send(
              JSON.stringify({
                type: 'party_sync',
                partyId: msg.partyId,
                videoId: existingState.videoId,
                isPlaying: existingState.isPlaying,
                currentTime: Math.max(0, existingState.currentTime + elapsed),
                actorName: existingState.actorName || 'Host',
                serverTimestamp: Date.now(),
              })
            );
          }
        } else if (msg.type === 'leave_party' && meta.partyId) {
          const leftParty = meta.partyId;
          meta.partyId = null;
          broadcastToParty(leftParty, {
            type: 'party_participants',
            partyId: leftParty,
            count: getPartyParticipantCount(leftParty),
          });
        } else if (msg.type === 'party_sync' && typeof msg.partyId === 'string') {
          const nextState: WatchPartySyncState = {
            videoId: typeof msg.videoId === 'string' ? msg.videoId : '',
            isPlaying: Boolean(msg.isPlaying),
            currentTime: Math.max(0, Number(msg.currentTime || 0)),
            updatedAt: Date.now(),
            actorName: typeof msg.actorName === 'string' ? msg.actorName : 'Participant',
          };
          watchPartyStates.set(msg.partyId, nextState);
          broadcastToParty(
            msg.partyId,
            {
              type: 'party_sync',
              partyId: msg.partyId,
              videoId: nextState.videoId,
              isPlaying: nextState.isPlaying,
              currentTime: nextState.currentTime,
              actorName: nextState.actorName,
              serverTimestamp: nextState.updatedAt,
            },
            ws
          );
        } else if (msg.type === 'party_chat' && typeof msg.partyId === 'string' && msg.payload) {
          broadcastToParty(msg.partyId, {
            type: 'party_chat',
            partyId: msg.partyId,
            payload: msg.payload,
          });
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    });

    ws.on('close', () => {
      const left = meta.streamId;
      const leftParty = meta.partyId;
      clients.delete(meta);
      if (left) {
        broadcastToStream(left, {
          type: 'viewer_count',
          streamId: left,
          count: getStreamViewerCount(left),
        });
      }
      if (leftParty) {
        broadcastToParty(leftParty, {
          type: 'party_participants',
          partyId: leftParty,
          count: getPartyParticipantCount(leftParty),
        });
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Frontend Serving (Vite Middleware in Dev, Static Dist in Production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BHARATPLAY server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BHARATPLAY server:', err);
  process.exit(1);
});
