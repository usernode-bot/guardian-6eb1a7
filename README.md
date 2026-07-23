# Guardian

A minimal Express/Node.js dapp scaffold running on Usernode Social Vibecoding.

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The server will start on port 3000.

### Running with Docker

```bash
docker build -t guardian .
docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_SECRET=... guardian
```

## Platform Documentation

See [CLAUDE.md](./CLAUDE.md) for app-specific notes and platform conventions at:
https://social-vibecoding.usernodelabs.org/claude.md
