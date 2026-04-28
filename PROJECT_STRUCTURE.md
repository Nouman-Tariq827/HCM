# Time-Off Management System

A complete full-stack Time-Off Management System with modern React frontend and NestJS backend.

## 📁 Project Structure

```
time-off-management-system/
├── backend/                    # NestJS Backend Application
│   ├── src/                   # Source code
│   ├── tests/                 # Test files
│   ├── docs/                  # Documentation
│   ├── package.json           # Backend dependencies
│   └── ...                    # Other backend files
├── frontend/                   # React Frontend Application
│   ├── src/                   # Source code
│   ├── public/                # Static files
│   ├── package.json           # Frontend dependencies
│   └── ...                    # Other frontend files
├── package.json               # Root package.json with workspace scripts
└── README.md                  # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install all dependencies (both frontend and backend)
npm run install:all

# Or install separately
npm run install:backend
npm run install:frontend
```

### Running the Applications

```bash
# Start both applications concurrently
npm run start:all

# Or start separately
npm run start:backend    # Backend runs on http://localhost:3000
npm run start:frontend   # Frontend runs on http://localhost:3001
```

### Testing

```bash
# Test backend
npm run test:backend

# Test frontend
npm run test:frontend
```

### Building

```bash
# Build backend
npm run build:backend

# Build frontend
npm run build:frontend
```

## 📋 Available Scripts

### Root Level Scripts
- `npm run install:all` - Install dependencies for both frontend and backend
- `npm run start:all` - Start both applications concurrently
- `npm run start:backend` - Start only the backend server
- `npm run start:frontend` - Start only the frontend application

### Backend Scripts (run from `backend/` directory)
- `npm start` - Start backend server
- `npm run start:dev` - Start in development mode
- `npm test` - Run all tests
- `npm run build` - Build the application

### Frontend Scripts (run from `frontend/` directory)
- `npm start` - Start frontend development server
- `npm test` - Run tests
- `npm run build` - Build for production

## 🔗 Application URLs

- **Backend API**: http://localhost:3000
- **Backend Documentation**: http://localhost:3000/api/docs
- **Frontend Application**: http://localhost:3001

## 🏗️ Architecture

### Backend (NestJS)
- RESTful API with comprehensive endpoints
- SQLite database with TypeORM
- HCM system synchronization
- Comprehensive test coverage
- Swagger API documentation

### Frontend (React)
- Modern React with TypeScript
- Material-UI components
- React Query for state management
- Form validation with React Hook Form
- Responsive design

## 📚 Documentation

- Backend API documentation available at `/api/docs`
- Technical documentation in `backend/docs/`
- Test results and reports in `backend/test-reports/`
