# CourseMaster — Comprehensive Bug Bashing & Project Debugging Report

**Project**: CourseMaster E-Learning Platform  
**Live Site**: [CourseMaster Frontend](https://course-master-front-end.vercel.app/)  
**Frontend Repository**: [courseMaster_frontEnd](https://github.com/Pullock4981/courseMaster_frontEnd)  
**Backend Repository**: [courseMaster_Backend](https://github.com/Pullock4981/courseMaster_Backend)  
**Date**: November 2026  
**Document Status**: Complete & Fully Verified  

---

## Executive Summary

During systematic bug-bashing and audit across UI/UX, functional flows, authentication & authorization, API integration, data handling, and backend business logic, **18 distinct bugs** were identified, reproduced, documented, and resolved.

All issues have been corrected across the frontend and backend repositories following clean code practices, preserving original project architecture, and verified locally without introducing regressions.

### Severity Breakdown
- **Critical (5)**: P1 — Core authentication broken, student enrollment blocked, dashboard crash, JWT auth bypass, and privilege escalation.
- **High (5)**: P1/P2 — Restrictive CORS preflight headers, unawaited DB saves, 10x quiz score calculation bug, admin assignment filter mismatch, and shared quiz radio button group collision.
- **Medium (5)**: P2/P3 — Direct course details enrollment state sync, 100x price display multiplier, all navbar links permanently active, mobile menu clipping, and banned user login enforcement.
- **Low (3)**: P3/P4 — Missing admin sidebar link, dark mode invisible email contrast, and course card title horizontal bleed.

---

## Bug Reports

### BUG-001: Plaintext Password Comparison Breaks All User Authentication
- **Bug ID & Title**: `BUG-001` — Plaintext password comparison breaks user login (Code-5 bug)
- **Category**: Authentication & Authorization / Backend
- **Priority & Severity**: **Critical / P1**
- **Location & Steps to Reproduce**:
  1. Navigate to `/login`.
  2. Input valid registered/seeded credentials (e.g., `admin@coursemaster.com` / `admin123` or `student@coursemaster.com` / `student123`).
  3. Click "Sign In".
- **Expected vs. Actual Result**:
  - *Expected*: The user credentials should be compared against the stored bcrypt hash using `bcrypt.compare()`, generating a JWT and redirecting to the authenticated dashboard.
  - *Actual*: Server responds with HTTP 400 `"Invalid email or password"`. Login fails for every user in the database.
- **Severity & Evidence**:
  - *Evidence*: `backend/src/services/auth.service.js`:
    ```javascript
    // Code-5 bug: plaintext equality check instead of bcrypt.compare
    const match = (password === user.passwordHash);
    ```
    Comparing plaintext password `'admin123'` directly with salted bcrypt hash `'$2b$10$...'` always yields `false`.
- **Fix & Verification Status**:
  - *Fix*: Replaced equality check with `const match = await bcrypt.compare(password, user.passwordHash);`.
  - *Status*: **Fixed & Verified**

---

### BUG-002: Inverted Logic Prevents Course Enrollment for Unenrolled Students
- **Bug ID & Title**: `BUG-002` — Inverted conditional logic prevents course enrollment
- **Category**: Functional Bugs / Backend Business Logic
- **Priority & Severity**: **Critical / P1**
- **Location & Steps to Reproduce**:
  1. Log in as a student.
  2. Navigate to any course details page (e.g., `/courses/:id`).
  3. Click the "Enroll Now" button.
- **Expected vs. Actual Result**:
  - *Expected*: When the student is not yet enrolled, the system creates an enrollment record in MongoDB and returns HTTP 201.
  - *Actual*: Server responds with HTTP 400 `"Already enrolled in this course"` when the user is NOT enrolled, completely blocking new enrollments. Conversely, if already enrolled, it attempts duplicate record creation.
- **Severity & Evidence**:
  - *Evidence*: `backend/src/services/enrollment.service.js`:
    ```javascript
    let enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
    if (!enrollment) {
      // Inverted logic bug: throws error when NOT enrolled
      throw new Error("Already enrolled in this course");
    }
    ```
- **Fix & Verification Status**:
  - *Fix*: Corrected condition to `if (enrollment) { throw new Error("Already enrolled in this course"); }`.
  - *Status*: **Fixed & Verified**

---

### BUG-003: Redux Store Payload Error Causes Student Dashboard Application Crash
- **Bug ID & Title**: `BUG-003` — Redux store payload access error crashes Student Dashboard (Code-6 bug)
- **Category**: Data Handling / Frontend State Management
- **Priority & Severity**: **Critical / P1**
- **Location & Steps to Reproduce**:
  1. Log in as a student.
  2. Navigate to the Student Dashboard at `/student`.
- **Expected vs. Actual Result**:
  - *Expected*: Enrolled courses list should render with progress percentages and access to the course player.
  - *Actual*: Application crashes with `TypeError: Cannot read properties of undefined (reading 'length')` at `StudentDashboard.jsx:172`.
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/store/slices/enrollmentSlice.js`:
    ```javascript
    .addCase(fetchMyEnrollments.fulfilled, (state, action) => {
        state.loading = false;
        // Code-6 bug: action.payload is the array, but trying to access .data makes it undefined
        state.enrollments = action.payload.data;
    })
    ```
    `res.data` was already returned by the thunk as an array. Accessing `.data` resulted in `undefined`, crashing `enrollments.length`.
- **Fix & Verification Status**:
  - *Fix*: Updated reducer to `state.enrollments = action.payload || [];`.
  - *Status*: **Fixed & Verified**

---

### BUG-004: Auth Middleware Silent Failure on Invalid JWT Token
- **Bug ID & Title**: `BUG-004` — Auth middleware invokes `next()` on token verification failure (Code-15 bug)
- **Category**: Authentication & Authorization / Security
- **Priority & Severity**: **Critical / P1**
- **Location & Steps to Reproduce**:
  1. Send an HTTP request to any protected route (e.g., `GET /api/enrollments/my` or `GET /api/assignments/my`) with an invalid or expired JWT header `Authorization: Bearer invalid_token`.
- **Expected vs. Actual Result**:
  - *Expected*: Server responds with HTTP 401 Unauthorized `{ message: "Invalid or expired token" }`.
  - *Actual*: Middleware swallows the error and calls `next()`, leaving `req.user` undefined. Subsequent route handlers throw unhandled `Cannot read properties of undefined (reading 'id')` or bypass security checks.
- **Severity & Evidence**:
  - *Evidence*: `backend/src/middlewares/authMiddleware.js`:
    ```javascript
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch {
      // Code-15 bug: calls next() when JWT verification fails instead of 401
      next();
    }
    ```
- **Fix & Verification Status**:
  - *Fix*: Updated `catch` block to return `res.status(401).json({ message: "Invalid or expired token" });`.
  - *Status*: **Fixed & Verified**

---

### BUG-005: Privilege Escalation Vulnerability & Ignored Admin Registration Key
- **Bug ID & Title**: `BUG-005` — Unchecked role payload permits privilege escalation while valid adminKey is ignored (Code-12 bug)
- **Category**: Authentication & Authorization / Security
- **Priority & Severity**: **Critical / P1**
- **Location & Steps to Reproduce**:
  1. Send a registration request `POST /api/auth/register` with `{ name: "Hacker", email: "h@h.com", password: "password", role: "admin" }` without providing `adminKey`.
  2. Send a registration request with a valid `adminKey`.
- **Expected vs. Actual Result**:
  - *Expected*: Users should only be assigned the `admin` role if they provide a valid `adminKey` matching `process.env.ADMIN_REGISTRATION_KEY`. Otherwise, the role must default to `"student"`.
  - *Actual*: Any user could directly escalate privileges to admin by passing `role: "admin"`. Conversely, a legitimate admin entering a valid `adminKey` remained a `"student"` because `adminKey` was ignored.
- **Severity & Evidence**:
  - *Evidence*: `backend/src/services/auth.service.js`:
    ```javascript
    // Code-12 bug: user can pass role directly in payload without adminKey verification
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || "student",
    });
    ```
- **Fix & Verification Status**:
  - *Fix*: Added server-side validation for `adminKey`:
    ```javascript
    let assignedRole = "student";
    if (adminKey) {
      if (process.env.ADMIN_REGISTRATION_KEY && adminKey === process.env.ADMIN_REGISTRATION_KEY) {
        assignedRole = "admin";
      } else {
        throw new Error("Invalid admin registration key");
      }
    }
    ```
  - *Status*: **Fixed & Verified**

---

### BUG-006: Custom CORS Header Restricts Allowed Methods and Blocks PUT/PATCH/DELETE Preflight
- **Bug ID & Title**: `BUG-006` — Custom header restricts allowed methods to GET/POST, breaking PUT/PATCH/DELETE (Code-10 bug)
- **Category**: API Integration / Security / CORS
- **Priority & Severity**: **High / P1**
- **Location & Steps to Reproduce**:
  1. Log in as Admin.
  2. Attempt to edit a course (`PATCH /api/admin/courses/:id`), delete a course (`DELETE /api/admin/courses/:id`), review an assignment (`PATCH /api/admin/assignments/:id/review`), or update a user role (`PATCH /api/users/:id/role`).
- **Expected vs. Actual Result**:
  - *Expected*: Browser preflight `OPTIONS` request succeeds and the `PATCH`/`DELETE` request modifies the resource.
  - *Actual*: Browser blocks the request with `Method PATCH is not allowed by Access-Control-Allow-Methods in preflight response`.
- **Severity & Evidence**:
  - *Evidence*: `backend/app.js`:
    ```javascript
    // Code-10 bug: custom header restricts allowed methods to GET and POST, breaking PUT/DELETE CORS preflights
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Methods", "GET, POST");
      next();
    });
    ```
- **Fix & Verification Status**:
  - *Fix*: Removed the restrictive override header and configured Express CORS middleware to permit `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
  - *Status*: **Fixed & Verified**

---

### BUG-007: Missing Await on Lesson Completion Progress Save
- **Bug ID & Title**: `BUG-007` — Unawaited async Mongoose `save()` drops lesson completion updates (Code-9 bug)
- **Category**: Data Handling / Backend & Database
- **Priority & Severity**: **High / P2**
- **Location & Steps to Reproduce**:
  1. Open the Course Player (`/courses/:id/player`).
  2. Click "Mark Lesson Complete" or submit a quiz/assignment.
- **Expected vs. Actual Result**:
  - *Expected*: The updated completion array and progress percentage are saved to MongoDB before the API responds.
  - *Actual*: `enrollment.save()` runs without `await`, causing race conditions, unhandled rejections on failure, and stale progress returned to the client.
- **Severity & Evidence**:
  - *Evidence*: `backend/src/services/enrollment.service.js`:
    ```javascript
    // Missing await on async Mongoose save (Code-9 bug)
    enrollment.save();
    return enrollment;
    ```
- **Fix & Verification Status**:
  - *Fix*: Added `await enrollment.save();`.
  - *Status*: **Fixed & Verified**

---

### BUG-008: Quiz Score Percentage Formula Multiplies by 10 Instead of 100
- **Bug ID & Title**: `BUG-008` — Quiz score percentage calculated out of 10 instead of 100 (Code-4 bug)
- **Category**: Functional Bugs / Data Handling
- **Priority & Severity**: **High / P2**
- **Location & Steps to Reproduce**:
  1. Log in as a student and open a lesson containing a quiz.
  2. Answer all questions correctly (e.g. 2 out of 2) and submit the quiz.
  3. View the score feedback or student dashboard statistics.
- **Expected vs. Actual Result**:
  - *Expected*: A score of 2/2 should yield 100% score.
  - *Actual*: The score is recorded as 10% (and 1/2 is recorded as 5%).
- **Severity & Evidence**:
  - *Evidence*: `backend/src/services/quiz.service.js`:
    ```javascript
    // Code-4 bug: multiplied by 10 instead of 100
    const percent = Math.round((score / total) * 10);
    ```
- **Fix & Verification Status**:
  - *Fix*: Corrected formula to `const percent = Math.round((score / total) * 100);`.
  - *Status*: **Fixed & Verified**

---

### BUG-009: Admin Assignment Query Field Mismatch Returns Empty Results
- **Bug ID & Title**: `BUG-009` — Admin assignments filter queries schema by `courseId` instead of `course` (Code-8 bug)
- **Category**: API Integration / Backend & Database
- **Priority & Severity**: **High / P2**
- **Location & Steps to Reproduce**:
  1. Log in as Admin.
  2. Navigate to the Assignments Review page at `/admin/assignments`.
  3. Filter assignments by a specific course.
- **Expected vs. Actual Result**:
  - *Expected*: Submissions for the selected course are retrieved and displayed.
  - *Actual*: Controller did not pass `req.query` to `adminService.getAssignments()`, and `adminService` queried `{ courseId: ... }` when the Mongoose schema field is named `course`, returning 0 records.
- **Severity & Evidence**:
  - *Evidence*:
    `backend/src/controllers/admin.controller.js`:
    `const data = await adminService.getAssignments();` (omitted `req.query`).
    `backend/src/services/admin.service.js`:
    `if (query.courseId) filter.courseId = query.courseId;`
- **Fix & Verification Status**:
  - *Fix*: Forwarded `req.query` from `admin.controller.js`, and updated service to `if (query.courseId) filter.course = query.courseId;`.
  - *Status*: **Fixed & Verified**

---

### BUG-010: Identical Radio Name Attribute Across All Quiz Questions Prevents Multiple Answers
- **Bug ID & Title**: `BUG-010` — Global radio button group name prevents answering multiple quiz questions
- **Category**: Functional Bugs / UI/UX
- **Priority & Severity**: **High / P2**
- **Location & Steps to Reproduce**:
  1. Open a course with a quiz containing multiple questions in the Course Player (`/courses/:id/player`).
  2. Select an answer for Question 1.
  3. Select an answer for Question 2.
- **Expected vs. Actual Result**:
  - *Expected*: Question 1 retains its selected option, and Question 2 has its own selected option.
  - *Actual*: Selecting an option in Question 2 immediately deselects the option in Question 1 because both HTML radio inputs share the identical `name="quiz-option"`.
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/pages/CoursePlayer/CoursePlayer.jsx`:
    ```jsx
    <input
      type="radio"
      name="quiz-option"
      checked={answers[qIdx] === oIdx}
      ...
    />
    ```
- **Fix & Verification Status**:
  - *Fix*: Scoped the radio name per question: `name={`quiz-option-${qIdx}`}`.
  - *Status*: **Fixed & Verified**

---

### BUG-011: Course Details Fails to Sync Enrollment State on Direct Navigation
- **Bug ID & Title**: `BUG-011` — Course Details page does not fetch user enrollments on direct page load
- **Category**: Functional Bugs / State Synchronization
- **Priority & Severity**: **Medium / P2**
- **Location & Steps to Reproduce**:
  1. Enroll in a course.
  2. Refresh the browser or navigate directly via URL to `/courses/:courseId`.
- **Expected vs. Actual Result**:
  - *Expected*: The page recognizes the student is already enrolled and displays "Go to Dashboard" and the Course Syllabus.
  - *Actual*: Redux `myEnrollments` is unpopulated, showing "Enroll Now" and hiding the syllabus. Clicking "Enroll Now" produces an enrollment error.
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/pages/CousrseDetails/CourseDetails.jsx`:
    `useEffect` only fetched `fetchCourseById(id)` and never dispatched `fetchMyEnrollments()`.
- **Fix & Verification Status**:
  - *Fix*: Added `dispatch(fetchMyEnrollments())` when `token` is present.
  - *Status*: **Fixed & Verified**

---

### BUG-012: Course Details Displays Price Multiplied by 100
- **Bug ID & Title**: `BUG-012` — Course fee is multiplied by 100 on Course Details page
- **Category**: UI/UX / Data Display
- **Priority & Severity**: **Medium / P2**
- **Location & Steps to Reproduce**:
  1. Navigate to any course details page (e.g. `/courses/:id`).
  2. Observe the displayed course fee.
- **Expected vs. Actual Result**:
  - *Expected*: Course price displays the real price (e.g., `৳ 5,000`).
  - *Actual*: Price displays as `৳ 500000` (5 lakhs).
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/pages/CousrseDetails/CourseDetails.jsx`:
    ```jsx
    <p className="text-2xl sm:text-3xl font-bold" ...>৳ {course.price * 100}</p>
    ```
- **Fix & Verification Status**:
  - *Fix*: Replaced `course.price * 100` with `course.price?.toLocaleString()`.
  - *Status*: **Fixed & Verified**

---

### BUG-013: All Navbar Links Permanently Highlighted Active
- **Bug ID & Title**: `BUG-013` — Navbar class evaluation highlights all navigation links simultaneously
- **Category**: UI/UX
- **Priority & Severity**: **Medium / P3**
- **Location & Steps to Reproduce**:
  1. Navigate to any route (Home `/`, Courses `/courses`, or Dashboard).
  2. Observe the desktop and mobile navigation links.
- **Expected vs. Actual Result**:
  - *Expected*: Only the link corresponding to the current active route should display the active primary styling.
  - *Actual*: Home, Courses, and Dashboard are all highlighted in bold primary color at all times.
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/components/shared/Navbar.jsx`:
    ```javascript
    const navLinkClass = ({ isActive, to }) =>
        (isActive || window.location.pathname.startsWith("/"))
            ? "text-primary font-semibold"
            : "text-base-content/80 hover:text-primary";
    ```
    Every URL pathname begins with `"/"`, so this expression always evaluated to `true`.
- **Fix & Verification Status**:
  - *Fix*: Corrected to `const navLinkClass = ({ isActive }) => isActive ? "text-primary font-semibold" : "text-base-content/80 hover:text-primary";`.
  - *Status*: **Fixed & Verified**

---

### BUG-014: Mobile Navigation Menu Cut Off by Height and Overflow Constraints
- **Bug ID & Title**: `BUG-014` — Mobile dropdown menu clipped by `max-h-32 overflow-hidden`
- **Category**: UI/UX / Responsiveness
- **Priority & Severity**: **Medium / P3**
- **Location & Steps to Reproduce**:
  1. Open the application in mobile viewport (< 768px).
  2. Click the hamburger menu icon in the navbar.
- **Expected vs. Actual Result**:
  - *Expected*: The full dropdown menu displays all options including Home, Courses, Dashboard, Profile, and Login/Logout.
  - *Actual*: The menu is restricted to 128px (`max-h-32`) and hidden overflow, truncating items and rendering action buttons completely unclickable.
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/components/shared/Navbar.jsx`:
    `className="... max-h-32 overflow-hidden ..."`
- **Fix & Verification Status**:
  - *Fix*: Changed classes to `max-h-[80vh] overflow-y-auto`.
  - *Status*: **Fixed & Verified**

---

### BUG-015: Banned Users Can Still Log In and Access the Application
- **Bug ID & Title**: `BUG-015` — Banned user status is not checked during authentication
- **Category**: Authentication & Authorization / Security
- **Priority & Severity**: **Medium / P3**
- **Location & Steps to Reproduce**:
  1. Log in as admin and ban a user via `/admin/users`.
  2. In another browser or incognito session, log in with the banned user's credentials.
- **Expected vs. Actual Result**:
  - *Expected*: Login attempt is denied with an appropriate message explaining account suspension.
  - *Actual*: Login succeeds and a valid JWT token is issued, bypassing the administrative ban.
- **Severity & Evidence**:
  - *Evidence*: `backend/src/services/auth.service.js`:
    `login()` function checked email and password hash, but never checked `user.isBanned`.
- **Fix & Verification Status**:
  - *Fix*: Added check in `auth.service.js`:
    `if (user.isBanned) throw new Error("Your account has been suspended. Please contact support.");`.
  - *Status*: **Fixed & Verified**

---

### BUG-016: Missing "Manage Courses" Link in Admin Sidebar Navigation
- **Bug ID & Title**: `BUG-016` — Admin sidebar lacks link to Manage Courses route
- **Category**: Functional Bugs / Navigation
- **Priority & Severity**: **Medium / P3**
- **Location & Steps to Reproduce**:
  1. Log in as Admin and view the Admin Sidebar on desktop or mobile.
- **Expected vs. Actual Result**:
  - *Expected*: Sidebar includes direct link to view and manage existing courses (`/admin/courses`).
  - *Actual*: Sidebar only had "Overview", "Add Course", "Video Classes", "Enrollments", "Assignments", "Analytics", and "Manage Users". The route `/admin/courses` was inaccessible from the sidebar.
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/pages/admin/components/AdminSidebar.jsx`:
    `BookOpen` icon was imported but omitted from `menuItems`.
- **Fix & Verification Status**:
  - *Fix*: Added `{ to: "/admin/courses", label: "Manage Courses", Icon: BookOpen, end: true }` to `menuItems`.
  - *Status*: **Fixed & Verified**

---

### BUG-017: User Email Invisible in Dark Mode on Manage Users Page
- **Bug ID & Title**: `BUG-017` — Hardcoded dark text color on Manage Users table renders email unreadable in dark mode
- **Category**: UI/UX / Accessibility
- **Priority & Severity**: **Low / P4**
- **Location & Steps to Reproduce**:
  1. Toggle theme to Dark Mode using the header moon/sun icon.
  2. Log in as Admin and navigate to `/admin/users`.
  3. Inspect the user table.
- **Expected vs. Actual Result**:
  - *Expected*: Email text adapts to theme colors with high contrast on dark backgrounds.
  - *Actual*: Email cell has inline hardcoded `#1e293b` (slate-800), rendering it nearly black against dark slate background.
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/pages/admin/pages/ManageUsers.jsx`:
    `<td style={{ color: '#1e293b' }}>{userItem.email}</td>`
- **Fix & Verification Status**:
  - *Fix*: Replaced inline style with responsive theme utility `className="text-base-content/80"`.
  - *Status*: **Fixed & Verified**

---

### BUG-018: Course Card Title Bleeds Out of Card Boundaries
- **Bug ID & Title**: `BUG-018` — `whitespace-nowrap overflow-visible` on Course Card titles causes layout breakage
- **Category**: UI/UX / Layout
- **Priority & Severity**: **Low / P4**
- **Location & Steps to Reproduce**:
  1. Navigate to `/courses` or Home `/`.
  2. View courses with long titles (e.g. "Complete Web Development Masterclass with Next.js & React 19").
- **Expected vs. Actual Result**:
  - *Expected*: Course titles wrap neatly onto two lines within card boundaries.
  - *Actual*: Title is forced onto one line (`whitespace-nowrap`), overflowing into neighboring cards and offscreen.
- **Severity & Evidence**:
  - *Evidence*: `frontend/src/components/CourseCard/CourseCard.jsx`:
    ```jsx
    <h2 className="card-title text-lg sm:text-xl font-bold leading-snug group-hover:text-primary transition-colors whitespace-nowrap overflow-visible">
    ```
- **Fix & Verification Status**:
  - *Fix*: Replaced `whitespace-nowrap overflow-visible` with `line-clamp-2`.
  - *Status*: **Fixed & Verified**

---

## Verification & Test Results Matrix

| Bug ID | Title | Severity | Priority | Status |
| :--- | :--- | :---: | :---: | :---: |
| **BUG-001** | Plaintext password check breaking login | Critical | P1 | **Fixed & Verified** |
| **BUG-002** | Inverted enrollment logic blocking students | Critical | P1 | **Fixed & Verified** |
| **BUG-003** | Redux enrollment payload undefined crash | Critical | P1 | **Fixed & Verified** |
| **BUG-004** | Auth middleware silent failure on invalid JWT | Critical | P1 | **Fixed & Verified** |
| **BUG-005** | Privilege escalation & ignored admin registration key | Critical | P1 | **Fixed & Verified** |
| **BUG-006** | CORS preflight restricting PUT/PATCH/DELETE | High | P1 | **Fixed & Verified** |
| **BUG-007** | Unawaited async Mongoose `enrollment.save()` | High | P2 | **Fixed & Verified** |
| **BUG-008** | Quiz score percentage multiplied by 10 instead of 100 | High | P2 | **Fixed & Verified** |
| **BUG-009** | Admin assignments course filter query mismatch | High | P2 | **Fixed & Verified** |
| **BUG-010** | Identical radio button group name across quiz questions | High | P2 | **Fixed & Verified** |
| **BUG-011** | Course Details missing direct enrollment fetch | Medium | P2 | **Fixed & Verified** |
| **BUG-012** | Course price overinflated by 100x multiplier | Medium | P2 | **Fixed & Verified** |
| **BUG-013** | All navbar links permanently highlighted active | Medium | P3 | **Fixed & Verified** |
| **BUG-014** | Mobile navigation dropdown clipped by `max-h-32` | Medium | P3 | **Fixed & Verified** |
| **BUG-015** | Banned user accounts able to log in | Medium | P3 | **Fixed & Verified** |
| **BUG-016** | Admin sidebar missing "Manage Courses" link | Medium | P3 | **Fixed & Verified** |
| **BUG-017** | User email invisible in Dark Mode | Low | P4 | **Fixed & Verified** |
| **BUG-018** | Course card title overflowing card container | Low | P4 | **Fixed & Verified** |
