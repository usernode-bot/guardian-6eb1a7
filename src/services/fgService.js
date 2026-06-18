// Mock user data for staging
const mockUserFG = {
  '-1': {
    fgHours: 12,
    sessions: [
      {
        sessionId: 's1',
        startTime: 0,
        endTime: 43200,
        duration: 43200,
      },
    ],
    duration: 43200,
  },
  '-2': {
    fgHours: 0.5,
    sessions: [
      {
        sessionId: 's2',
        startTime: 0,
        endTime: 1800,
        duration: 1800,
      },
    ],
    duration: 1800,
  },
};

async function getUserFGHours(userId) {
  const data = mockUserFG[userId];
  return data ? data.fgHours : 0;
}

async function getFGSessions(userId) {
  const data = mockUserFG[userId];
  return data ? data.sessions : [];
}

async function getSessionDuration(userId) {
  const data = mockUserFG[userId];
  return data ? data.duration : 0;
}

async function getFGData(userId) {
  const data = mockUserFG[userId];
  return data || { fgHours: 0, sessions: [], duration: 0 };
}

module.exports = {
  getUserFGHours,
  getFGSessions,
  getSessionDuration,
  getFGData
};
