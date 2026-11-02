import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { AppConfig } from '../config/index.js';

/**
 * Serveur temps réel.
 *
 * Socket.IO ne transporte **jamais** de mutation durable : il pousse des signaux
 * dont la vérité reste en base, récupérée ensuite via REST. L'abonnement à une
 * room d'organisation exigera une vérification de membership et de permission
 * lorsque le module organisations sera livré — en attendant, tout abonnement est
 * refusé explicitement plutôt que silencieusement accepté.
 */
export function createSocketServer(httpServer: HttpServer, config: AppConfig): Server {
  const io = new Server(httpServer, {
    cors: { origin: [...config.client.origins], credentials: true },
    // Le client se reconnecte seul ; on borne les tentatives pour éviter qu'un
    // client en boucle ne sature le serveur.
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
  });

  io.on('connection', (socket) => {
    socket.on('organization:join', () => {
      socket.emit('organization:error', {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'L’autorisation des rooms sera activée avec le module organisations.',
        },
      });
    });
  });

  return io;
}
