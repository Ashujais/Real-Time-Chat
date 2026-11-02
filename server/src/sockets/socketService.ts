import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export function setIO(io: Server): void {
  ioInstance = io;
}

export function getIO(): Server | null {
  return ioInstance;
}

export function emitToRoom(roomId: string, event: string, payload: any): void {
  if (ioInstance) {
    ioInstance.to(roomId).emit(event, payload);
  }
}

export function emitToUser(userId: string, event: string, payload: any): void {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, payload);
  }
}

export function broadcastGlobal(event: string, payload: any): void {
  if (ioInstance) {
    ioInstance.emit(event, payload);
  }
}
