import { io as Client } from 'socket.io-client';
import { server, io, maps } from '../../../backend/server.js'; 

const URL = 'http://localhost:3000';

let clientSocket;

beforeAll((done) => {
  server.listen(3000, done);
});

afterAll((done) => {
  io.close();
  server.close(done);
});

beforeEach((done) => {
  clientSocket = new Client(URL);
  clientSocket.on('connect', done);
});

afterEach(() => {
  if (clientSocket.connected) {
    clientSocket.disconnect();
  }
});

test('join-map adds user to maps structure', (done) => {
  const testPayload = { mapId: 'testMap', userId: 'user123' };

  clientSocket.emit('join-map', testPayload);

  // Warte kurz, bis Server reagiert
  setTimeout(() => {
    const map = maps.get('testMap');
    expect(map).toBeDefined();
    expect(map.users['user123']).toBeDefined();
    done();
  }, 100);
});
