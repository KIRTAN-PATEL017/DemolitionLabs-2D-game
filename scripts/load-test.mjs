import WebSocket from 'ws';

const NUM_CLIENTS = parseInt(process.argv[2] || "1000", 10);
const CLIENTS_PER_ROOM = 2;

console.log(`🚀 Starting load test with ${NUM_CLIENTS} clients across ${NUM_CLIENTS / CLIENTS_PER_ROOM} rooms...`);

let connected = 0;
const clients = [];

for (let i = 0; i < NUM_CLIENTS; i++) {
  // Stagger connections by 5ms to avoid overwhelming the port immediately
  setTimeout(() => {
    const roomId = `load-test-room-${Math.floor(i / CLIENTS_PER_ROOM)}`;
    const url = `ws://localhost:3001/room/${roomId}`;
    const ws = new WebSocket(url);
    clients.push(ws);

    ws.on('open', () => {
      connected++;
      if (connected === NUM_CLIENTS) {
        console.log(`✅ All ${NUM_CLIENTS} clients connected successfully! Bombarding server with inputs...`);
      }
      
      // Send random inputs 10 times a second
      setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        const inputs = [
          { type: 'MOVE', dir: 'NORTH' },
          { type: 'MOVE', dir: 'SOUTH' },
          { type: 'MOVE', dir: 'EAST' },
          { type: 'MOVE', dir: 'WEST' },
          { type: 'PLACE_BOMB' },
          { type: 'NOOP' }
        ];
        
        const randomInput = inputs[Math.floor(Math.random() * inputs.length)];
        
        ws.send(JSON.stringify({
          type: 'INPUT',
          payload: randomInput
        }));
      }, 100);
    });

    ws.on('error', (err) => {
      console.error(`❌ Client ${i} error:`, err.message);
    });
    
    ws.on('close', () => {
      connected--;
    });
  }, i * 5);
}
