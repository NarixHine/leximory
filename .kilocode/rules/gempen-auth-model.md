# Auth Model

**Goal**
Build auth for a school SaaS (each school = Better Auth organization; each class in school = Better Auth team). Teachers publish assignments for students in their classes; school admins manage classes and assign teachers; students complete and submit homework. All users in a school may use AI features; admins manage organization-wide AI settings and quotas.

* As a **school admin**, I can create/delete classes, assign teachers to classes, invite staff/students, and configure org-level AI settings and quotas.
* As a **teacher**, I can enroll students into my classes, create/publish/update/delete assignments for *my* classes, view submissions from students in my classes, and grade them.
* As a **student**, I can view assignments for my classes, submit homework, and view my grades. I can use AI features allowed by my school.
* As an **owner**, I have full permissions across resources and AI configuration.
* As the system, I must prevent teachers from editing/reading assignments or submissions that are not for their classes.

**Resources & operations (acceptance):**

* `assignment` — operations: `create`, `update`, `delete`, `read`, `submit`, `grade`, `viewSubmissions`.

  * Acceptance: A teacher with `assignment.create` for class A can create an assignment that is scoped to class A. Another teacher without membership in A cannot create/edit grade/view submissions for class A.
  * Students may only `submit` and `read` published assignments that belong to classes where they are enrolled.

* `ai` — operations: `use`.

  * Acceptance: `ai.use` is granted to all normal roles (owner/admin/teacher/student) by default.

**Non-functional constraints:**

* All permission checks must be enforced server-side for sensitive actions (grading, publishing, configuring AI settings).
* The role system must support *dynamic* checks (teacher-of-class-X) — i.e., roles + runtime membership checks.
