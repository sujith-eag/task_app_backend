# Academics Domain (Phase 0)

The Academics domain handles academic resources, study materials, and class-specific content sharing.

## 📋 Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Architecture](#architecture)
- [Planned Features](#planned-features)
- [Integration with Existing Systems](#integration-with-existing-systems)

## Overview

The Academics domain is designed to centralize all academic content management, including:

- **Study Materials**: Course materials, lecture notes, textbooks
- **Resource Sharing**: Share files with specific classes/batches
- **Content Organization**: Organize materials by subject, topic, and session
- **Access Control**: Role-based access for teachers and students

## Current Status

**🚧 UNDER DEVELOPMENT - Placeholder Structure**

Currently, academic file sharing functionality is handled by the existing **Shares domain** (`src/api/shares/`) which includes class-based sharing capabilities.

### Existing Class Sharing (via Shares Domain)

The Shares domain already provides:
- `shareWithClass()` - Share files with batch/semester/section
- Class-based access control via `FileShare.accessType = 'class'`
- Query files shared with student's class

**Recommendation**: Leverage the existing Shares domain for academic file sharing rather than creating duplicate functionality.

## Architecture

```
src/api/academics/
├── controllers/               # Request handlers (placeholder)
│   ├── materials.controller.js
│   └── resources.controller.js
├── services/                  # Business logic (placeholder)
│   ├── materials.service.js
│   └── resources.service.js
├── routes/                    # Route definitions (placeholder)
│   ├── materials.routes.js
│   └── resources.routes.js
├── validators/                # Input validation (placeholder)
│   └── academics.validators.js
└── academics.routes.js        # Main router
```

## Planned Features

### 1. Study Materials Management

**Description**: Organize and categorize academic content

**Features**:
- Upload study materials (PDFs, documents, presentations)
- Categorize by subject, topic, and type (notes, textbook, reference)
- Tag materials with keywords for easy discovery
- Version control for updated materials
- Preview capabilities for common file types

**API Endpoints** (Planned):
```
POST   /api/academics/materials              - Upload study material
GET    /api/academics/materials              - List materials
GET    /api/academics/materials/:id          - Get material details
PATCH  /api/academics/materials/:id          - Update material metadata
DELETE /api/academics/materials/:id          - Delete material
GET    /api/academics/materials/search       - Search materials
```

### 2. Class Resource Sharing

**Description**: Share resources with specific classes

**Features**:
- Share materials with batch/semester/section combinations
- Set expiration dates for time-sensitive materials
- Track download statistics
- Notification system for new materials
- Bulk sharing capabilities

**API Endpoints** (Planned):
```
POST   /api/academics/share/class            - Share with class
GET    /api/academics/share/my-classes       - Get materials for my classes
GET    /api/academics/share/:shareId         - Get share details
DELETE /api/academics/share/:shareId         - Remove share
```

**Note**: This functionality overlaps with the existing Shares domain. Consider using:
```
POST /api/shares/class - Existing class sharing endpoint
```

### 3. Resource Library

**Description**: Centralized repository of academic resources

**Features**:
- Department-wide resource repository
- Subject-wise categorization
- Recommended resources by faculty
- Student ratings and reviews
- Most downloaded/viewed tracking

**API Endpoints** (Planned):
```
GET    /api/academics/library                - Browse library
GET    /api/academics/library/:subjectId     - Subject-specific resources
POST   /api/academics/library/:id/rate       - Rate a resource
GET    /api/academics/library/recommended    - Get recommended resources
```

### 4. Session Materials

**Description**: Link study materials to specific class sessions

**Features**:
- Attach materials to class sessions
- Pre-class and post-class materials
- Session-specific resources
- Integration with Attendance domain
- Timeline view of materials

**API Endpoints** (Planned):
```
POST   /api/academics/sessions/:sessionId/materials  - Attach material to session
GET    /api/academics/sessions/:sessionId/materials  - Get session materials
GET    /api/academics/students/timeline              - Student's material timeline
```

### 5. Content Analytics

**Description**: Track engagement with academic materials

**Features**:
- View/download statistics
- Student engagement tracking
- Popular materials identification
- Gap analysis (under-utilized materials)
- Teacher insights dashboard

**API Endpoints** (Planned):
```
GET    /api/academics/analytics/materials/:id        - Material analytics
GET    /api/academics/analytics/teacher              - Teacher's content analytics
GET    /api/academics/analytics/subject/:subjectId   - Subject-level analytics
```

## Integration with Existing Systems

### Shares Domain Integration

**Current State**: The Shares domain (`src/api/shares/`) already handles class-based file sharing.

**Existing Endpoints**:
```javascript
// Share file with class
POST /api/shares/class
{
  "itemId": "fileId",
  "batch": 2020,
  "semester": 5,
  "section": "A",
  "expiresAt": "2024-12-31"
}

// Get files shared with my class (student)
GET /api/shares/class/my-shared-items

// Unshare from class (teacher)
DELETE /api/shares/:shareId
```

**Recommendation**: 
1. Use existing Shares domain for file distribution
2. Academics domain focuses on material categorization and organization
3. Create views/aggregations over Shares domain for academic context

### Attendance Domain Integration

Link materials to specific class sessions:
- Pre-session materials (preparation)
- During-session materials (lecture slides)
- Post-session materials (practice problems, solutions)

### Files Domain Integration

Leverage existing file management:
- File upload handled by Files domain
- Academics domain adds academic-specific metadata
- Organize files into materials with additional context

### Potential Data Model

```javascript
// AcademicMaterial (Planned)
{
  fileId: ObjectId,              // Reference to File
  subject: ObjectId,             // Reference to Subject
  type: String,                  // 'notes', 'textbook', 'reference', 'slides'
  title: String,
  description: String,
  topic: String,
  keywords: [String],
  sessionId: ObjectId,           // Optional: Link to ClassSession
  uploadedBy: ObjectId,          // Teacher
  isPublic: Boolean,             // Department-wide visibility
  downloadCount: Number,
  viewCount: Number,
  ratings: [{
    student: ObjectId,
    rating: Number,
    comment: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## Implementation Priority

**Phase 0 (Current)**: Placeholder structure  
**Phase 1**: Material categorization and organization  
**Phase 2**: Session-material linking  
**Phase 3**: Analytics and insights  
**Phase 4**: Advanced features (ratings, recommendations)

## Development Notes

### Why Placeholder?

The Academics domain is currently a placeholder because:

1. **Existing Coverage**: Shares domain already handles class-based file distribution
2. **Prioritization**: Attendance and Feedback domains are higher priority
3. **Design Clarity**: Need to clearly define boundaries between Shares and Academics
4. **Avoid Duplication**: Prevent duplicate functionality across domains

### Next Steps

1. **Audit Existing Shares Domain**: Identify gaps in academic content management
2. **Define Clear Boundaries**: Establish when to use Shares vs Academics
3. **Design Data Models**: Create AcademicMaterial and related models
4. **Implement Incrementally**: Start with material categorization, then expand
5. **Integration Layer**: Build services that aggregate Shares + Academics

### Temporary Solution

**For Now**: Use the Shares domain for academic file distribution:

```javascript
// Teacher shares study material with class
POST /api/shares/class
{
  "itemId": "fileId",
  "batch": 2020,
  "semester": 5,
  "section": "A"
}

// Students access shared materials
GET /api/shares/class/my-shared-items
```

## Migration Path

When implementing the Academics domain:

1. **Keep Shares Domain**: Don't migrate existing class sharing functionality
2. **Add Academic Layer**: Create academic materials as metadata on top of shared files
3. **Gradual Transition**: Introduce academic-specific features incrementally
4. **Maintain Compatibility**: Ensure existing file sharing continues to work

## Future Enhancements

- **AI-powered Recommendations**: Suggest materials based on learning patterns
- **Collaborative Annotations**: Students and teachers can annotate materials
- **Version Control**: Track changes to materials over time
- **Offline Access**: Download materials for offline viewing
- **Interactive Content**: Support for quizzes, interactive diagrams
- **Content Marketplace**: Share materials across institutions
- **Accessibility**: Screen reader support, text-to-speech
- **Multi-language Support**: Materials in multiple languages

## Questions to Resolve

1. Should Academics domain manage files or just metadata?
2. How to prevent duplication with Shares domain?
3. Should session materials be in Attendance or Academics domain?
4. How to handle material visibility (public vs class-specific)?
5. Should we support third-party content integration (YouTube, external links)?

---

**Last Updated**: January 2024  
**Phase**: 0 (Placeholder)  
**Status**: Under Development  
**Contact**: Development Team for questions or suggestions
