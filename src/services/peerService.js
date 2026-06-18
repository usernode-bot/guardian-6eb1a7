// Mock peer data for staging
const mockNodeStatus = {
  peers: 23,
  uptime: '2h 14m',
  fgActive: true,
};

const mockPeerList = [
  { id: 'peer-001', status: 'online' },
  { id: 'peer-002', status: 'online' },
  { id: 'peer-003', status: 'online' },
  { id: 'peer-004', status: 'offline' },
  { id: 'peer-005', status: 'online' },
];

async function getNodeStatus() {
  return mockNodeStatus;
}

async function getPeerList() {
  return mockPeerList;
}

module.exports = {
  getNodeStatus,
  getPeerList
};
