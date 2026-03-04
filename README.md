# 🚀 SocialMine Backend

Complete social media platform backend with crypto integration.

## ✨ Features

- 🔐 **Authentication** - JWT-based auth with refresh tokens
- 📝 **Posts** - Create, read, update, delete, like posts
- 💬 **Comments** - Nested comments and replies
- 👤 **Profiles** - User profiles with follow system
- 🔔 **Notifications** - Real-time notifications
- 📸 **File Uploads** - Cloudinary integration

## 🛠️ Tech Stack

- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- JWT Authentication
- Cloudinary for file storage
- Jest for testing
- Swagger for API docs

## 🚀 Quick Start

\\\ash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Configure .env with your credentials

# Run migrations
npx prisma migrate dev

# Start server
npm run dev
\\\

Server runs at: http://localhost:3000

## 📚 API Documentation

Interactive Swagger docs: http://localhost:3000/api-docs

## 🧪 Testing

\\\ash
npm test              # Run tests
npm run test:coverage # Coverage report
\\\

## 📁 Project Structure

\\\
src/
├── config/          # Configuration
├── controllers/     # Request handlers
├── middleware/      # Custom middleware
├── routes/          # API routes
├── utils/           # Utilities
└── app.ts           # Express app

tests/               # Test files
prisma/              # Database schema
\\\

## 🔌 Main Endpoints

### Authentication
- POST /api/v1/auth/signup
- POST /api/v1/auth/login
- POST /api/v1/auth/logout

### Posts
- POST /api/v1/posts
- GET /api/v1/posts
- PUT /api/v1/posts/:id
- DELETE /api/v1/posts/:id
- POST /api/v1/posts/:id/like

### Comments
- POST /api/v1/comments
- GET /api/v1/comments/post/:postId
- POST /api/v1/comments/:id/like

### Profile
- GET /api/v1/profile/:username
- PUT /api/v1/profile/me
- POST /api/v1/profile/:username/follow

### Notifications
- GET /api/v1/notifications
- PUT /api/v1/notifications/read-all

### Upload
- POST /api/v1/upload/profile
- POST /api/v1/upload/post

## 🔒 Security

- JWT authentication
- bcrypt password hashing
- Helmet security headers
- CORS configuration
- Rate limiting
- Input validation

## 🚀 Deployment

Ready to deploy to Railway, Render, or AWS.

## 📝 Environment Variables

\\\env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
\\\

## 📊 Test Coverage

- 17 passing tests
- 48% code coverage
- All core features tested

## 📄 License

MIT

## 👨‍💻 Author

Your Name

---

⭐ **Star this repo if you find it useful!**
