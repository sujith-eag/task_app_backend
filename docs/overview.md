# Project Context: Eagle Campus Application

## 1. Project Overview & Goal

**Eagle Campus** is a production-grade, full-stack MERN application that has evolved from a personal productivity tool into a comprehensive platform for both individual task management and institutional education. It is architected with a scalable, feature-based design to showcase modern web development practices.  

The application combines three core pillars: a powerful, AI-driven task planner; a complete **college management module** with real-time features, role-based access control, secure real-time attendance tracking via Socket.IO, anonymous student feedback, and full administrative control over the academic structure; and an **advanced cloud drive** for secure file and folder management.

## 2. Technology Stack

### Frontend

- **Framework**: React (with Vite)
- **UI Library**: Material-UI (MUI) v5+
- **State Management**: Redux Toolkit
- **API Client**: Axios
- **Routing**: `react-router-dom`
- **Animations**: Framer Motion
- **Notifications**: `react-toastify`
- **SVG Handling**: `vite-plugin-svgr`
- Strict form data validation

### Backend

- **Environment**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT), Passport.js (foundation for OAuth)
- **File Handling**: AWS S3, Multer, archiver (for zip streaming)
- **Caching**: **node-cache** (for server-side URL caching)
- **Real-Time**: Socket.IO
- **AI**: Google AI SDK (`@google/generative-ai`)
- **Email**: Nodemailer, Brevo
- **Validation**: Joi
- **Security**: bcryptjs, helmet, express-rate-limit, cookie-parser, express-session

### Deployment & Cloud Services

- **Frontend**: Netlify
- **Backend**: Amazon Web Services (AWS) **EC2** (migrated from Render)
- **File Storage**: Amazon Web Services (AWS) **S3**

## 3. High-Level Feature Overview

### Core Features
- **User Authentication & Authorization**: Secure registration, email verification, login with JWT, password reset, role-based access control
- **User Profile & Account Management**: Comprehensive profile management with avatar uploads (AWS S3), password changes, user preferences (discoverability, file sharing, messaging), student application system
- **Task Management**: Full CRUD for tasks with properties like `title`, `description`, `dueDate`, `priority`, `status`, and `tags`. Nested sub-task checklists
- **AI-Powered Interactive Planning**: Conversational task generation with Google Gemini API
- **Timetable Management**: Academic schedule visualization with session tracking and subject integration

### College Management System
A complete module for educational institutions, built upon a sophisticated role-based access control system.

- **Advanced Role-Based Access Control (RBAC)**: Multi-tiered hierarchy: `user`, `student`, `teacher`, `hod`, `admin`
- **Secure, Real-Time Attendance**: Teachers initiate class sessions with unique 60-second codes, Socket.IO for real-time updates
- **Anonymous Student Feedback**: Students provide anonymous feedback on attended classes
- **Comprehensive Administrative Control**: Subject management, faculty management, user management, reporting dashboards

### Advanced Features
- **Advanced File Management & Sharing**: Production-grade system built on AWS S3 for personal and collaborative file management with hierarchical folder structure, public sharing codes, and class-wide distribution
- **Real-Time Messaging & Collaboration**: Complete 1-on-1 messaging system built with Socket.IO with typing indicators and message status tracking
- **Multi-Level Administrative Reporting**: Comprehensive reporting suite for attendance and feedback analysis with teacher-centric and student-centric drill-down reports
- **Storage Management & Quotas**: Role-based storage quotas with real-time usage tracking and aggregation

## 4. Deployment Configuration

### Frontend (Netlify)
- **SPA Routing Fix**: Includes `public/_redirects` file with rewrite rule (`/* /index.html 200`) to handle client-side routing
- **Custom 404 Page**: Dedicated "Not Found" page with custom illustration via catch-all route (`path="*"`)

### Backend (AWS EC2)
- **Server Entry Point**: `server.js` initializes Express app, connects to MongoDB
- **Preloaded Environment**: Uses `-r dotenv/config` to ensure environment variables are available on startup
- **Socket.IO Integration**: Configured for real-time features with authentication middleware

## 5. Key Design Principles

### Modularity
- Feature-based architecture where each feature is self-contained
- Co-location of related code (pages, components, services, state)
- Clear separation of concerns

### Security
- JWT-based authentication
- Role-based access control with middleware
- Rate limiting on sensitive endpoints
- Input validation with Joi schemas
- Secure file handling with AWS S3

### Performance
- Optimistic UI updates for instant feedback
- Server-side caching for S3 URLs
- Efficient real-time updates with Socket.IO rooms
- Lazy loading and code splitting

### User Experience
- Responsive design for mobile and desktop
- Light/dark mode theming
- Smooth animations with Framer Motion
- Non-blocking "Undo" patterns
- Real-time presence indicators
- Comprehensive error handling and user feedback
- Accessibility considerations (ARIA roles, keyboard navigation)

