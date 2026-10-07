# UBIDS ATTENDANCE

## User Guide

**System name:** UBIDS ATTENDANCE  
**Institution:** University of Business and Integrated Development Studies  
**Document type:** User guide for staff and office administrators  
**Version:** 1.0  
**Date:** 24 September 2026  

This guide describes how to use the system as it is built. It does not describe features that are not in the system. Items marked **[NEEDS VERIFICATION]** must be confirmed by the institution before the guide is issued to staff.

[SCREENSHOT 01 — Cover or home screen]

Caption: UBIDS ATTENDANCE home or sign-in screen.

Description: Shows the institution logo and the name UBIDS ATTENDANCE.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [System requirements](#2-system-requirements)
3. [Accessing the system](#3-accessing-the-system)
4. [User roles and permissions](#4-user-roles-and-permissions)
5. [Dashboard](#5-dashboard)
6. [System modules](#6-system-modules)
7. [Important workflows](#7-important-workflows)
8. [Reports](#8-reports)
9. [Settings](#9-settings)
10. [Notifications and emails](#10-notifications-and-emails)
11. [Troubleshooting](#11-troubleshooting)
12. [Frequently asked questions](#12-frequently-asked-questions)
13. [Security and best practices](#13-security-and-best-practices)
14. [Support](#14-support)
15. [Screenshot checklist](#15-screenshot-checklist)
16. [Documentation verification checklist](#16-documentation-verification-checklist)

---

## 1. Introduction

### 1.1 Purpose of the system

UBIDS ATTENDANCE records whether lecturers and non-teaching staff are present for their scheduled sessions. It can require a location check and a face check before attendance is accepted. Office administrators use the same system to manage people, schedules, venues, approvals, reports, messages, and support requests.

### 1.2 System overview

The system has three ways to work:

| Area | Who uses it | How they sign in |
| --- | --- | --- |
| Staff area | Lecturers and non-teaching staff | Email address and password at the main sign-in page |
| Office administration | Users created under Users, with assigned roles | Email address and password at the same main sign-in page |
| Quick attendance portal | Staff who are given a Staff ID for fast attendance | Staff ID only, on the attendance portal page |

After sign-in, the menu on the left shows only the pages that account is allowed to open.

### 1.3 Intended users

- Lecturers who must check in and check out of teaching sessions.
- Non-teaching staff (staff type **Administrator**) who must check in and check out of work shifts.
- Directors/Deans and Heads of Department, who review their unit in addition to their own attendance.
- Office administrators who maintain staff, schedules, venues, reports, and system settings.

There is no public registration page. A person cannot create their own account. An office administrator creates the account.

### 1.4 Key features

- Today’s sessions and one-tap paths to take attendance.
- Location check against the venue and its allowed radius, when GPS enforcement is turned on.
- Face check against a face enrolled by an office administrator, when facial recognition is turned on.
- Check-in and check-out, including late arrival, early leave, and overtime labels.
- Self-reported absence, attendance explanations, and venue change requests.
- Unit review for Directors/Deans and Heads of Department.
- Schedules, courses, records, reminders, and reports.
- Messages, in-app notifications, and emails when those options are turned on.
- Help Desk tickets.
- Office tools for people, school structure, timetables, holidays, logs, and settings.

---

## 2. System requirements

The system does not lock the user to one browser brand. Camera and location features need a current browser that allows those permissions.

| Requirement | What users need |
| --- | --- |
| Browser | A current version of Chrome, Edge, or Safari. **[NEEDS VERIFICATION]** if the institution has an official browser list. |
| Device for attendance | A phone or tablet with GPS and a front camera is recommended when location and face checks are on. A desktop computer can be used for reports and administration. |
| Internet | A working connection to the system address. Attendance cannot be saved offline. |
| Camera | Required when facial recognition is turned on. The browser must be allowed to use the camera. |
| Location | Required when GPS enforcement is turned on. Location services and browser location permission must be allowed. The reading must be fresh and accurate enough. |
| Account | An account created by an office administrator. Self-registration is not available. |

**Note:** The official web address for staff is **[NEEDS VERIFICATION]**. Do not publish a developer or local address in the issued copy of this guide.

---

## 3. Accessing the system

### 3.1 Main sign-in

1. Open the system address in the browser.
2. On **Sign in to your account**, enter **Email address** and **Password**.
3. Select **Sign in**.

What you see next depends on the account:

- A lecturer or non-teaching staff member opens the staff home.
- An office administrator opens the administration dashboard.

[SCREENSHOT 02 — Main sign-in page]

Caption: Sign in to your account.

Description: Shows Email address, Password, Forgot password?, and the Sign in button.

**Warning:** If the email or password is wrong, you stay on the sign-in page. Do not keep guessing. Use **Forgot password?** or contact an office administrator.

### 3.2 Quick attendance portal

This page is separate from the main sign-in. It asks for a Staff ID, not an email and password.

1. Open the attendance portal address. The path on the system is `/attendance`. The full address is **[NEEDS VERIFICATION]**.
2. Enter **Staff ID** exactly as issued. The screen says: “Use your employee ID exactly as issued by the institution.”
3. Continue into the portal.
4. Check in or check out for today’s session.
5. After a successful check-in, the portal signs you out automatically.

[SCREENSHOT 03 — Attendance portal sign-in]

Caption: Staff ID attendance sign-in.

Description: Shows the Staff ID field and the instruction to use the employee ID exactly as issued.

### 3.3 Sign out

1. Open the account menu at the bottom of the left sidebar.
2. Select **Log out**.

On the email-verification screen, **Log out** is also available.

Always sign out on a shared computer or shared phone.

### 3.4 Password reset

**Forgot password?** appears on the main sign-in page only when the system setting **Allow admin users and lecturers to request a password reset link** is turned on.

1. On the sign-in page, select **Forgot password?**.
2. Enter the **Email address** for the account.
3. Select **Email password reset link**.
4. Open the email and follow the link.
5. Enter and confirm the new password.

The reset request is limited so it cannot be sent repeatedly in a short time.

**Note:** The quick attendance portal does not have a password. If a Staff ID is rejected, ask an office administrator to confirm the employee ID.

[SCREENSHOT 04 — Forgot password page]

Caption: Forgot password.

Description: Shows the email address field and the Email password reset link button.

### 3.5 Profile and password

Signed-in users can open:

| Page | What it is for |
| --- | --- |
| Profile settings | View and update the profile details the screen allows |
| Password | Change the password while signed in |
| Appearance settings | Choose **Light**, **Dark**, or **System** |

**Warning:** Profile settings include **Delete account**. The screen states that this cannot be undone. Staff and office administrators should not delete their own account. Ask an administrator if an account must be closed.

[SCREENSHOT 05 — Profile settings]

Caption: Profile settings.

Description: Shows the profile form and the Delete account warning.

---

## 4. User roles and permissions

The system uses two account types, plus an optional leadership assignment on a staff account.

Office administrator **role names are created in the system**. The software does not ship with one fixed role such as “Super Admin.” What an office user can open depends on the permissions ticked on their role. **[NEEDS VERIFICATION]** of the role names used at the institution.

| Role | Access | Main responsibilities |
| --- | --- | --- |
| Lecturer | Staff menu: Dashboard, Take Attendance, Explanations, My Schedules, My Courses, Records, Reminders, Reports, Communication, Help Desk | Check in and check out of teaching sessions. View own schedule, courses, records, and reports. Send explanations and messages. |
| Non-teaching staff (staff type Administrator) | Staff menu: Dashboard, Take Attendance, Explanations, Venue Change Requests, Attendance Report, Communication, Help Desk. Lecturer class tools are hidden. | Check in and check out of shifts. Request a venue change when that option is turned on. View own attendance report. |
| Director/Dean | Own staff menu, plus **My Unit** for the assigned faculty | Review unit staff and unit attendance. Review self-reported absences and venue change requests and authorizations for that faculty. |
| Head of Department | Own staff menu, plus **My Unit** for the assigned department | Same unit tasks as a Director/Dean, limited to the department. |
| Office administrator | Administration menu items allowed by the assigned role | Manage staff, users, schedules, venues, reports, approvals, messages, settings, holidays, logs, and Help Desk, according to permissions. |

### 4.1 What office permissions control

Permissions are grouped. A role may have view, create, edit, delete, export, or manage rights. If a menu item is missing, that account does not have permission for it.

| Area | Examples of what the permission allows |
| --- | --- |
| Dashboard | Open the administration dashboard |
| Staff | View, add, edit, or delete staff. Reset staff passwords. Enroll a face on the staff record. |
| Users and roles | View, add, edit, or delete office users. Assign roles. Reset an office user’s password. Export users. |
| Teaching attendance | View and export lecturer attendance |
| Non-teaching attendance | View and export non-teaching attendance |
| Schedules | View, create, edit, or delete timetables. Manage rescheduled sessions. |
| School | Faculties, departments, and venues |
| Catalog | Academic years, academic periods, programs, and courses |
| Approvals | Venue change requests, venue change authorizations, and attendance explanations |
| Communication | Read, compose, and send messages, including limits on who can be messaged |
| System | Settings, holidays and breaks, system logs |
| Help Desk | View and manage tickets |

A lecturer cannot open office administration by using the staff menu. An office administrator does not take lecturer attendance unless that person also has a staff account.

---

## 5. Dashboard

### 5.1 Lecturer home

The page title is **Teacher Dashboard**. The banner says **Lecturer home** and greets the person by title and first name. It shows subject, department, the date, and the next class when one exists.

Summary figures:

| Figure | Meaning |
| --- | --- |
| Today | Number of classes today |
| Pending | How many still need attendance |
| Students | Student total on the profile |

Quick actions: **Take attendance**, **My schedules**, **My courses**, **Reminders**, **Inbox**, **Explanations**.

Cards:

| Card | Meaning |
| --- | --- |
| Classes assigned | Classes for this academic year |
| Attendance today | Sessions already marked out of today’s target |
| Pending attendance | Sessions that still need attention |
| Total records | All attendance records for the account |

Lecturers also see unread notifications and an attendance chart with **Today**, **This week**, **This month**, and **This semester**.

[SCREENSHOT 06 — Lecturer dashboard]

Caption: Lecturer home.

Description: Shows the greeting, summary figures, quick actions, and attendance cards.

### 5.2 Non-teaching staff home

The banner says **Staff home**. Summary figures show **Role**, **Unit**, and **Approvals** waiting.

The page states: “Your account is administrative staff. Lecturer class tools are hidden. Use Take Attendance to check in or check out for your shift.”

Actions include **Open Take Attendance** and **View attendance report**.

If venue change requests are waiting for a leader, a banner shows how many are waiting and a **Review requests** button.

[SCREENSHOT 07 — Non-teaching staff dashboard]

Caption: Staff home.

Description: Shows the administrative staff notice and the Take Attendance action.

### 5.3 Office administrator dashboard

The page is titled **Dashboard**. It shows a welcome header, summary cards, quick actions, and **Attendance Analytics**.

Charts:

- Daily Attendance Trend
- Today’s Attendance Breakdown
- Verification Analytics (face success, face failure, location success, location failure)
- Period Attendance Comparison
- Faculty Distribution

Time filters on the analytics section follow the buttons shown on that page.

Menu items appear only when the signed-in role has permission.

[SCREENSHOT 08 — Administration dashboard]

Caption: Administration dashboard.

Description: Shows summary cards, quick actions, and attendance analytics.

---

## 6. System modules

### 6.1 Take Attendance — lecturers

**Purpose:** Check in and check out of today’s teaching session.

**Who can access it:** Lecturers.

**How to open it:** Attendance → **Take Attendance**, or the dashboard action **Take attendance**.

**What you do:**

1. Select the current session.
2. If GPS enforcement is on, allow location and wait until the location check finishes.
3. If facial recognition is on, complete the face check.
4. Select **Check In**.
5. Later, select **Check Out**, **Check Out (Early Leave)**, or **Check Out (Overtime)**, depending on the time.

**Expected result:** A success message. The session shows as checked in, then as completed after check-out.

**Important notes:**

- You must check out of the current session before checking in to another. The screen can say **Check out of current session first**.
- Attendance is not open before the allowed check-in time.
- A missed or rescheduled session can be blocked.
- A holiday or break can suspend attendance.
- If face enrollment is required and no face is enrolled, attendance is refused until an office administrator enrolls the face.

[SCREENSHOT 09 — Lecturer Take Attendance]

Caption: Lecturer session list.

Description: Shows today’s sessions and the check-in state.

### 6.2 Take Attendance — non-teaching staff

**Purpose:** Check in and check out of today’s work shift.

**Who can access it:** Staff whose type is Administrator.

**How to open it:** Attendance → **Take Attendance**.

The same location and face rules apply when those settings are on. The session is a shift, not a class.

[SCREENSHOT 10 — Non-teaching Take Attendance]

Caption: Shift attendance.

Description: Shows today’s shift and the check-in or check-out action.

### 6.3 Quick attendance portal

**Purpose:** Mark today’s attendance with a Staff ID, without the full menu.

**Who can access it:** A staff member whose employee ID is accepted by the portal.

**How to open it:** The `/attendance` address.

After check-in succeeds, the portal signs the person out. Do not leave the device signed in.

[SCREENSHOT 11 — Attendance portal sessions]

Caption: Portal session list.

Description: Shows the Staff ID and today’s check-in or check-out choice.

### 6.4 Explanations

**Purpose:** Explain an absence or an early departure.

**Who can access it:** Lecturers and non-teaching staff.

**How to open it:** Attendance → **Explanations**.

**What you do:**

1. Open **Explanations**.
2. Complete the explanation the form asks for.
3. Submit it.

**Expected result:** The explanation is waiting for review. An office administrator can approve or reject it. You may be notified when that happens, if notification settings are on.

[SCREENSHOT 12 — Attendance explanations]

Caption: Explanations list.

Description: Shows existing explanations and how to submit one.

### 6.5 Venue change requests

**Purpose:** Ask to use a different venue for a shift.

**Who can access it:** Non-teaching staff, when **administrator venue change requests** are turned on. Lecturers do not use this request screen for class venues.

**How to open it:** Attendance → **Venue Change Requests**.

**Expected result:** The request waits for a Director/Dean, Head of Department, or office administrator. Existing approved authorizations still work if new requests are later turned off.

[SCREENSHOT 13 — Venue change request]

Caption: Venue change request form.

Description: Shows the fields required to ask for another venue.

### 6.6 My Schedules and My Courses

**Purpose:** See assigned teaching times and courses.

**Who can access it:** Lecturers. **My Schedules** is under Academic. **My Courses** is under Academic.

A printable timetable page exists for the lecturer schedule.

[SCREENSHOT 14 — My Schedules]

Caption: My Schedules.

Description: Shows the lecturer’s assigned sessions.

### 6.7 Records, Reminders, and Reports (lecturer)

**Purpose:**

| Menu item | Purpose |
| --- | --- |
| Records | Past attendance records |
| Reminders | Items that still need attention |
| Reports | The lecturer’s own attendance report |

**Who can access it:** Lecturers, under **My Work**.

[SCREENSHOT 15 — Lecturer records or report]

Caption: Lecturer records.

Description: Shows the lecturer’s own attendance history.

### 6.8 Attendance report (non-teaching staff)

**Purpose:** See your own shift attendance.

**Who can access it:** Non-teaching staff.

**How to open it:** Attendance → **Attendance Report**, or **View attendance report** on the staff home.

### 6.9 Self-reported absence

**Purpose:** Tell the institution you will be absent for a session.

**Who can access it:** The staff member for their own session. Leaders can review these under **My Unit**.

**Expected result:** The absence is recorded. A leader can open it and reply.

[SCREENSHOT 16 — Self-reported absence]

Caption: Self-reported absence form.

Description: Shows the fields the staff member must complete.

### 6.10 My Unit (leaders only)

**Purpose:** Review the faculty or department assigned to the leader.

**Who can access it:** A staff member assigned as **Director/Dean** or **Head of Department**. The role label appears under the logo.

| Menu item | What it is for |
| --- | --- |
| Unit Staff | People in the unit |
| Unit Attendance | Attendance for the unit |
| Self-reported Absences | Absences submitted by unit staff |
| Venue Change Requests | Requests waiting for approval |
| Venue Change Authorizations | Approved venue changes |

**What you do with a request:** Open it, review the details, then approve or reject it. The staff member can be notified of the result.

[SCREENSHOT 17 — Unit venue change requests]

Caption: Venue change requests awaiting approval.

Description: Shows a pending request and the approve or reject actions.

### 6.11 Communication

**Purpose:** Read and send messages inside the system.

**Who can access it:** Staff and office administrators who have communication permission.

Staff menu: **Inbox**, **Sent**, **Drafts**, **All Mail**, **Dashboard**, **Compose**.

Office menu: the same areas, under Communication. Who an office user may message (selected staff, all staff, faculties, or departments) depends on permissions.

**What you do to send a message:**

1. Open **Compose**.
2. Complete the recipients, subject, and message.
3. Send, or save a draft if that action is on the screen.

**Expected result:** The message appears in **Sent**. The recipient sees it in **Inbox**.

[SCREENSHOT 18 — Inbox]

Caption: Inbox.

Description: Shows the message list.

[SCREENSHOT 19 — Compose message]

Caption: Compose.

Description: Shows recipient, subject, and message fields.

### 6.12 Help Desk

**Purpose:** Ask for help or report a problem.

**Who can access it:** Staff, under Support → **Help Desk**. Office administrators with Help Desk permission manage the queue.

**Required fields on a new ticket:**

| Field | Required |
| --- | --- |
| Subject | Yes |
| Description | Yes |
| Category | Yes. Choices: Technical Issue, Account Issue, System Request, Other |
| Priority | Yes. Choices: Low, Medium, High, Urgent |
| Attachment | Optional |

**What you do:**

1. Open **Help Desk**.
2. Select the action to submit a ticket.
3. Complete the fields.
4. Submit.

**Expected result:** The ticket is **Open**. Support can move it to **In Progress**, **Resolved**, or **Closed**. You can be emailed when the ticket is updated.

[SCREENSHOT 20 — Submit a ticket]

Caption: Submit a ticket.

Description: Shows Subject, Category, Priority, Description, and the submit button.

### 6.13 Notifications

**Purpose:** See alerts without opening email.

**Who can access it:** Staff. Lecturers see unread items on the dashboard. A notifications page and notification preferences page exist for staff.

**What you do:** Open the notification, or open **Reminders** for items that need attention. Use notification preferences to control what you receive, where the screen offers that choice.

### 6.14 People — staff records

**Purpose:** Create and maintain lecturer and non-teaching staff accounts, including face enrollment.

**Who can access it:** Office administrators with staff permissions.

**How to open it:** People → **Staff** → **All Staff**, **Add Staff**, or **Password Management**.

**What you do to add staff:**

1. Open **Add Staff**.
2. Complete the required identity, contact, staff type, faculty, and department fields shown on the form.
3. Choose Lecturer or Administrator as the staff type.
4. Optionally assign **Director/Dean** (with a faculty) or **Head of Department** (with a department).
5. Save.

**Face enrollment** is on the staff create/edit screen, under **Facial Recognition Enrollment**.

1. Open the staff record for edit. A brand-new unsaved record cannot be enrolled yet. The system says to create the staff member first, then open Edit Staff Member.
2. Select **Enroll Face** or **Re-enroll Face**.
3. Allow the camera, or upload a clear image. Exactly one face must be visible.
4. Select **Save Face Enrollment**.

To remove an enrollment, use the remove action on that same section when it is shown.

**Password Management** resets a staff password. It does not use the staff member’s old password.

[SCREENSHOT 21 — Staff list]

Caption: All Staff.

Description: Shows the staff list, including face enrollment status.

[SCREENSHOT 22 — Enroll Face]

Caption: Facial Recognition Enrollment.

Description: Shows Enroll Face or Re-enroll Face and the camera capture.

### 6.15 People — office users and roles

**Purpose:** Create office accounts and decide what each role can open.

**Who can access it:** Office administrators with user-management permissions.

**How to open it:** People → **Users** → **All Users**, **Add User**, or **User Roles**.

**What you do:**

1. Create a role and tick only the permissions that role should have.
2. Create a user and assign at least one role.
3. Tell the person their sign-in email and temporary password through a safe channel.

[SCREENSHOT 23 — User roles]

Caption: User roles and permissions.

Description: Shows a role and the permissions that can be ticked.

### 6.16 Schedules

**Purpose:** Assign sessions to staff and venues.

**Who can access it:** Office administrators with timetable permissions.

| Menu item | What it is for |
| --- | --- |
| Assigned Schedules | View and maintain sessions |
| Create Schedule | Add one session |
| Bulk Create Schedules | Add many sessions |
| Generate Time Table | Build a timetable from the generator screen |
| Rescheduled Sessions | Move a session to another time or venue |
| Venue Change Authorizations | Authorize a venue directly, without waiting for a staff request |
| Venue Change Requests | Review requests submitted by non-teaching staff |

A session needs a day, start time, end time, staff member, and venue. Teaching sessions also need a course.

[SCREENSHOT 24 — Create schedule]

Caption: Create Schedule.

Description: Shows the fields required to assign a session.

### 6.17 School and catalog

**Purpose:** Hold the structure that schedules depend on.

| Menu | Items |
| --- | --- |
| School | Faculties, Departments, Venues |
| Catalog | Academic Years, Academic Periods, Programs, Courses |

A venue can store a map location and an allowed radius in meters. Attendance uses that location when GPS enforcement is on. If a venue has no coordinates, the system cannot prove the person is at that venue.

[SCREENSHOT 25 — Venue with location]

Caption: Venue location and radius.

Description: Shows the venue name, map point, and allowed radius.

### 6.18 Holidays and breaks

**Purpose:** Suspend attendance for a defined period, or mark duty exceptions.

**Who can access it:** Office administrators with holiday permissions.

**How to open it:** System → **Holidays & Breaks**.

When a break suspends attendance, staff see the holiday message and cannot check in for that period.

[SCREENSHOT 26 — Holidays and breaks]

Caption: Holidays and breaks.

Description: Shows a break and whether attendance is suspended.

### 6.19 System logs

**Purpose:** Review activity recorded by the system, including attendance attempts when logging is turned on.

**Who can access it:** Office administrators with system-log permissions. Export and manage actions require those extra permissions.

**How to open it:** System → **System Logs**.

### 6.20 System settings

Documented in [Section 9](#9-settings). Only office administrators with settings permission can open **System Settings**.

---

## 7. Important workflows

### 7.1 Lecturer check-in

1. Sign in with email and password.
2. Open **Take Attendance**.
3. Select the session for now.
4. If the session is not open yet, wait until the allowed check-in time. The screen tells you when check-in starts.
5. If location is required, allow location. Wait for **Getting your location...**, then the distance check.
6. If the result is **Location verified**, continue.
7. If facial recognition is required, center your face in the guide and let verification finish.
8. Select **Check In**.
9. Read the success message. It states whether you are early, on time, or late.

**Expected result:** The session is checked in. You cannot check in to a second session until you check out of this one.

### 7.2 Lecturer check-out

1. Stay signed in, or sign in again.
2. Open **Take Attendance**.
3. Select the session you checked in to.
4. Complete location and face checks again if the system asks for them.
5. Select the check-out button:
   - **Check Out** during the normal window.
   - **Check Out (Early Leave)** before the session end.
   - **Check Out (Overtime)** after the grace period.
6. Confirm the success message.

### 7.3 Non-teaching check-in and check-out

Use the same steps as the lecturer workflow, on **Take Attendance** for shifts. The home page says lecturer class tools are hidden.

### 7.4 Location verification

When GPS enforcement is on:

1. The browser asks for location permission. Choose Allow.
2. The system requests a fresh high-accuracy reading. It does not keep using an old point from a previous attempt.
3. It compares your position with the venue coordinates and the venue radius.
4. It also reads the GPS accuracy.

| Result | What it means | What you do |
| --- | --- | --- |
| Location verified | The reading is accurate enough and can still be inside the venue | Continue to face verification or submit |
| Outside the permitted location | Even allowing for the GPS accuracy, you are outside the radius | Move to the venue and select **Try Again** |
| Location accuracy is too low | The phone cannot place you reliably | Turn on GPS, move to a clearer signal, and select **Try Again** |
| Location permission denied | The browser was blocked from using location | Allow location for the site, then **Try Again** |
| Location request timed out | No usable reading arrived in time | **Try Again** in a more open area |
| Location services unavailable | GPS or location services are off | Turn them on, then **Try Again** |

The screen can show:

- Distance from venue
- Allowed radius
- GPS accuracy

A poor reading is not treated as “out of range.” The radius is not widened to hide a bad reading.

[SCREENSHOT 27 — Location verified]

Caption: Location verified.

Description: Shows distance, allowed radius, and GPS accuracy.

[SCREENSHOT 28 — Location needs another try]

Caption: Location accuracy is too low, or out of range, with Try Again.

Description: Shows the message and the Try Again button.

### 7.5 Face enrollment

This is done by an office administrator, not by the staff member alone.

1. Open **Staff** and edit the person.
2. Select **Enroll Face**.
3. Use the camera or upload one clear image with exactly one face.
4. Select **Save Face Enrollment**.
5. Confirm the status changes to **Enrolled**.

Use **Re-enroll Face** if the person has changed appearance and verification keeps failing.

[SCREENSHOT 29 — Face enrollment camera]

Caption: Enroll Lecturer Face.

Description: Shows the camera guide and Save Face Enrollment. The title says lecturer even when the same control is used from the staff form.

### 7.6 Face verification during attendance

1. After location is accepted, the camera opens.
2. Allow camera access if the browser asks.
3. Center your face in the oval. Verification can start automatically when the face is stable.
4. The system compares the live face with the enrolled face.

| Result | What you see | What you do |
| --- | --- | --- |
| Match | Location confirmed, then attendance can be submitted | Continue |
| Face not recognized | The face does not match the enrolled profile | Improve light, look at the camera, and select **Try Again** |
| No enrollment | Face enrollment is required before attendance | Ask an office administrator to enroll your face |
| Camera blocked | The browser cannot use the camera | Allow the camera for this site and **Try Again** |

The face check expires after the configured lifetime (default 120 seconds). If you wait too long, verify again.

[SCREENSHOT 30 — Face verification]

Caption: Face verification.

Description: Shows the camera oval and the instruction to center the face.

### 7.7 Absence and explanation

1. If you know you will be absent, submit a self-reported absence where that action is offered for the session.
2. If you were marked absent or left early, open **Explanations** and submit the explanation.
3. A leader can review self-reported absences for their unit.
4. An office administrator opens **Attendance Explanations**, reads the submission and any document, then approves or rejects it.
5. You may receive an in-app notice and an email when it is approved or rejected, if those notifications are on.

### 7.8 Venue change

1. A non-teaching staff member submits **Venue Change Requests**, if that setting is on.
2. The assigned Director/Dean and Head of Department can be notified.
3. A leader opens **My Unit → Venue Change Requests** and approves or rejects.
4. An office administrator can do the same under **Venue Change Requests**, or can create a **Venue Change Authorization** directly.
5. After approval, attendance for that period uses the authorized venue.

### 7.9 Schedule and reschedule

1. An office administrator creates the venue, course, and staff record first.
2. They create the session under **Create Schedule** or **Bulk Create Schedules**.
3. To move a session, they use **Rescheduled Sessions**.
4. Staff then see the effective time and venue on **Take Attendance**. A session that was missed or replaced can show a blocked message instead of a check-in button.

### 7.10 Reports

1. Open the report for your role (see [Section 8](#8-reports)).
2. Set the filters you need.
3. Read the on-screen totals.
4. If you have export permission, choose Excel, CSV, PDF, or Print.

### 7.11 User management

1. Create the role and its permissions.
2. Create the user and assign the role.
3. The person signs in at the main sign-in page.
4. Use password management or the user’s own **Password** page when a password must change.

### 7.12 Settings change

1. Open **System Settings**.
2. Choose the tab: General, Attendance, Map & Location, Notifications & Logs, or Security.
3. Change the values.
4. Save.
5. Tell affected staff what changed, especially GPS, face recognition, and check-in times.

---

## 8. Reports

| Report | Who opens it | What it shows |
| --- | --- | --- |
| Lecturer **Reports** | The lecturer | That lecturer’s own attendance |
| Non-teaching **Attendance Report** | The staff member | That person’s shift attendance |
| **Teaching Staff** attendance | Office administrators with attendance view permission | Lecturer attendance, verification rates, and records |
| **Non-Teaching Staff** attendance | Office administrators with staff-attendance view permission | Shift attendance and verification rates |
| Unit Attendance | Director/Dean or Head of Department | Attendance for their unit |
| Attendance analysis | Office administrators, from the teaching attendance tools where the link is shown | Further analysis of lecturer attendance |

Filters on the office reports follow the controls on the page, including date and status filters such as geolocation status where that filter is shown.

**Export,** when the account has export permission:

| Format | Button |
| --- | --- |
| Excel | Excel or the export action for xlsx |
| CSV | CSV |
| PDF | PDF |
| Paper | Print |

**How to read verification results:**

| Label | Meaning |
| --- | --- |
| Geolocation verified / success | The stored check-in was inside the venue rule |
| Geolocation failed | The stored check-in was not marked inside the venue |
| Face verified | A matching face was accepted for that attendance |
| Enrolled / Not Enrolled | Whether an office administrator has saved a face for that person |

[SCREENSHOT 31 — Teaching staff attendance report]

Caption: Teaching staff attendance report.

Description: Shows filters, totals, and export buttons.

---

## 9. Settings

### 9.1 Personal settings

Available to signed-in staff and office administrators:

| Setting | What it controls |
| --- | --- |
| Profile settings | The profile fields shown on that page |
| Password | The sign-in password. You must know the current password. |
| Appearance | **Light**, **Dark**, or **System** |
| Notification preferences | Which staff notices you receive, on the preferences page |

### 9.2 System settings

Path: System → **System Settings**. Only accounts with settings permission can view them. Editing requires the edit permission.

Values below are the system defaults. The live system may already have been changed. **[NEEDS VERIFICATION]** of the values currently saved.

**General**

| Setting | What it controls | Default |
| --- | --- | --- |
| Application name | Name on the header, sign-in, and browser title | UBIDS ATTENDANCE |
| Application logo | Logo image | Institution logo file |
| Institution name | Organization label | University of Business and Integrated Development Studies |
| Time zone | Default time zone | The server time zone |
| Date format | How dates are stored and shown | Y-m-d |
| Time format | How times are stored and shown | H:i |
| Log retention days | How long activity logs are kept | 90 |

**Attendance**

| Setting | What it controls | Default |
| --- | --- | --- |
| GPS radius | Default allowed radius in meters for a venue that uses this default | 50 |
| GPS enforcement | Whether check-in and check-out must pass the location rule | On |
| Late check-in minutes | Minutes after the start time before a check-in is late | 15 |
| Administrator early check-in | How many minutes before the shift administrators may check in | 30 |
| Teacher early check-in | How many minutes before the class lecturers may check in | 30 |
| Check-out grace period | Minutes after the end time that check-out is still compliant | 30 |
| Early leave minutes | Minutes before the end that count as early leave | 15 |
| Auto-mark absent after end | Mark the person absent after the session ends if they did not attend | On |
| Email on auto absence | Send email when someone is marked absent | On |
| Manual override | Allow an administrator to override attendance | On |
| Facial recognition | Require a face check | On |
| Face match threshold | How close the live face must be to the enrolled face | 0.45 |
| Face verification timeout | How long a successful face check stays valid, in seconds | 120 |
| Face enrollment required | Block attendance when no face is enrolled | Off |
| Administrator venue change requests | Allow non-teaching staff to submit venue change requests | On |

**Map & Location**

| Setting | What it controls | Default |
| --- | --- | --- |
| Google Maps API key | Optional key used to show maps | Empty |
| Default campus latitude and longitude | Optional campus map center | Empty |
| Maximum check-in distance | A configured maximum distance in meters | 200 |
| Validate location accuracy | Older on/off flag for an accuracy threshold | Off |

The attendance screen’s own rule still rejects a reading whose accuracy is worse than 100 meters, and it accepts a reading only when the accuracy circle can still reach the venue.

**Notifications & Logs**

| Setting | What it controls | Default |
| --- | --- | --- |
| Attendance logs | Record attendance activity | On |
| Log GPS attempts | Record location on check-in and check-out | On |
| Log failed attempts | Record failed attendance attempts | On |
| Venue change authorized | Notify staff when an authorization is approved | On |
| Venue change request submitted | Notify administrators, and separately notify the Director/Dean and Head of Department | On |
| Venue change approved or rejected | Notify the staff member | On |
| Explanation submitted | Notify administrators | On |
| Explanation approved or rejected | Notify the staff member | On |

**Security**

| Setting | What it controls | Default |
| --- | --- | --- |
| Forgot password | Show **Forgot password?** and send a reset link to admin users and lecturers | On |

[SCREENSHOT 32 — System settings, Attendance tab]

Caption: Attendance settings.

Description: Shows GPS, timing, and facial recognition settings.

---

## 10. Notifications and emails

### 10.1 Where to read them

- Lecturer dashboard: unread notifications.
- Staff notification list and **Reminders**.
- Email, when the related setting is on and the account has an email address.

### 10.2 When they are sent

| Event | Who is notified | Email as well? |
| --- | --- | --- |
| Check-in or check-out result | The staff member, through the attendance notice path | When mail is configured |
| Automatic absence | The lecturer or administrator | Only if **Email on auto absence** is on |
| Venue change request submitted | Office administrators, and the assigned Director/Dean and Head of Department | When those notify settings are on |
| Venue change approved, rejected, or authorized | The staff member | When those notify settings are on |
| Explanation submitted | Office administrators | When that notify setting is on |
| Explanation approved or rejected | The staff member | When those notify settings are on |
| Help Desk ticket submitted or updated | The support side or the staff member, depending on the event | Yes, the Help Desk mail notices include the ticket subject |
| Password reset | The address entered on **Forgot password?** | Yes, the reset link is sent by email |

**[NEEDS VERIFICATION]** of the live mail sender name and whether mail delivery is working in the institution’s email system.

---

## 11. Troubleshooting

| Problem | Possible cause | Solution |
| --- | --- | --- |
| Cannot sign in | Wrong email or password, or the account does not exist | Use **Forgot password?** if it is shown, or ask an office administrator to reset the password |
| Forgot password link does not appear | The security setting is off | An office administrator must turn on forgot-password or reset the password from Password Management |
| Reset email does not arrive | Wrong email, delay, or mail is not configured | Check the email address. Wait, then try again. You cannot request a reset many times in a few minutes. |
| Staff ID is rejected | The ID does not match the employee ID on the staff record | Enter it exactly as issued. Ask an administrator to check the employee ID. |
| Camera permission denied | The browser blocked the camera | Allow the camera for this site in the browser settings, then select **Try Again** |
| Location permission denied | The browser blocked location | Allow location for this site, then select **Try Again** |
| Location services unavailable | GPS is off on the phone | Turn on location services and **Try Again** |
| Location request timed out | Weak signal or the request took too long | Move to a clearer area and **Try Again** |
| Location accuracy is too low | The reading is coarser than 100 meters, or it is too old | Turn on GPS, wait for a fresh reading, and **Try Again**. Do not expect the radius to be increased. |
| Outside the permitted location | You are beyond the venue radius even after GPS accuracy is considered, or the venue coordinates are wrong | Move inside the venue and **Try Again**. If you are standing in the correct room, ask an administrator to check the venue pin and radius. |
| This session does not have a valid attendance location | The venue has no coordinates or the radius is not set, while GPS enforcement is on | An administrator must set the venue location and radius |
| Face not recognized | Lighting, camera angle, or the enrolled photo no longer matches | Use **Try Again**. If it continues, ask an administrator to **Re-enroll Face**. |
| Face enrollment is required | No face has been saved for this account | An administrator must enroll the face before attendance |
| Attendance is not open yet | Check-in starts only a set number of minutes before the session | Wait until the time shown on the screen |
| Check out of current session first | Another session is still checked in | Check out of that session, then check in to the new one |
| Attendance unavailable because the session was rescheduled or missed | The original session is locked | Follow the replacement session, or submit an explanation if you were marked absent |
| Holiday or break message | Attendance is suspended for that period | Do not check in. Contact the office if you were asked to work during the break. |
| Network error or the page keeps loading | The connection dropped | Refresh once. If it continues, check the network before submitting again. |
| Export button is missing | The role does not have export permission | Ask an administrator to grant the export permission if export is part of your job |
| A menu item is missing | The role does not include that permission, or the item belongs to the other staff type | Confirm your staff type and role with an administrator |
| Delete account was used | The profile page allows permanent deletion | Contact an administrator immediately. Staff should not use **Delete account**. |

---

## 12. Frequently asked questions

**Can I create my own account?**  
No. Registration is not available. An office administrator creates your account.

**Which password do I use on the attendance portal?**  
None. The portal asks for your Staff ID only. The main system asks for email and password.

**Why can my colleague see menus I cannot see?**  
Menus follow staff type, leadership assignment, and office permissions. A missing menu means that account is not allowed to open it.

**Do I enroll my own face?**  
No. An office administrator enrolls or re-enrolls your face on your staff record.

**Why was I told the location is inaccurate instead of out of range?**  
The phone could not provide a reliable position. Turn on GPS and select **Try Again**. The system will not mark you out of range just because the reading is poor.

**Why does my position seem to jump while I am standing still?**  
Older behavior could reuse a weak network position. The current check takes a fresh reading and keeps the most accurate sample. If it still fails, use **Try Again** with GPS turned on.

**Can I check in from home if I am teaching online?**  
Only if GPS enforcement is off, or an authorized venue change covers that place. With GPS enforcement on, you must satisfy the venue radius.

**What if I forget to check out?**  
You may be marked for early leave, overtime, or absence according to the timing settings. Submit an explanation if you need the record reviewed.

**Who approves a venue change?**  
A Director/Dean, a Head of Department for that unit, or an office administrator. An office administrator can also authorize a venue directly.

**Can I change the allowed radius myself?**  
No. Venue radius and system attendance settings are office administrator tasks.

**How do I get a report of my own attendance?**  
Lecturers use **Reports**. Non-teaching staff use **Attendance Report**.

---

## 13. Security and best practices

- Use a password you do not use on other websites. Do not share it.
- Office administrators should give a temporary password through a private channel and ask the person to change it under **Password**.
- Sign out with **Log out** when you finish, especially on a shared phone or office computer.
- Allow camera and location only for this system, and only while taking attendance.
- Do not ask someone else to check in for you. Face verification is there to show that you are the enrolled person.
- Do not upload a group photo for face enrollment. Exactly one face must be visible.
- Do not send Staff IDs, passwords, or attendance screenshots of other people through personal chat.
- Do not use **Delete account** to “clean up” a record. That action is permanent.
- Office administrators should give each role only the permissions that job needs.
- Review system logs when a location or face failure needs to be investigated. Logs can include coordinates, distance, accuracy, and the reason for failure when logging is on.

---

## 14. Support

Use **Help Desk** in the system first.

1. Open **Help Desk**.
2. Submit a ticket.
3. Set the category: Technical Issue, Account Issue, System Request, or Other.
4. Set the priority.
5. Describe what you were trying to do, what you saw, and the time it happened.
6. Attach a screenshot if it helps, without showing another person’s private data.

Include:

- Your name and Staff ID or email
- Lecturer, non-teaching staff, leader, or office administrator
- The page name, such as Take Attendance or Sign in
- The exact message on the screen
- Whether you were checking in or checking out
- Phone model and browser, if the problem is camera or location
- Distance, allowed radius, and GPS accuracy if the location panel showed them

**[NEEDS VERIFICATION]:** office name, support email, phone number, and working hours to print in the issued guide.

You will be told when the ticket moves to In Progress, Resolved, or Closed.

---

## 15. Screenshot checklist

No screenshots are stored in the project for this guide. The logo file used by the system is `/images/ubids-logo.png`. Capture the images below from the live system.

| No. | Screenshot | Page or feature | Required |
| --- | --- | --- | --- |
| 01 | Home or logo | Cover | Yes |
| 02 | Sign in to your account | Main login | Yes |
| 03 | Staff ID sign-in | Attendance portal | Yes |
| 04 | Forgot password | Password reset | Yes |
| 05 | Profile settings | Account | Yes |
| 06 | Lecturer home | Lecturer dashboard | Yes |
| 07 | Staff home | Non-teaching dashboard | Yes |
| 08 | Administration dashboard | Office dashboard | Yes |
| 09 | Lecturer session list | Take Attendance | Yes |
| 10 | Shift attendance | Non-teaching Take Attendance | Yes |
| 11 | Portal sessions | Quick portal | Yes |
| 12 | Explanations | Attendance explanations | Yes |
| 13 | Venue change request | Staff request form | Yes |
| 14 | My Schedules | Lecturer schedule | Yes |
| 15 | Records or report | Lecturer history | Recommended |
| 16 | Self-reported absence | Absence form | Yes |
| 17 | Unit venue change requests | Leader approval | Yes |
| 18 | Inbox | Communication | Recommended |
| 19 | Compose | Communication | Recommended |
| 20 | Submit a ticket | Help Desk | Yes |
| 21 | All Staff | Staff list | Yes |
| 22 | Enroll Face | Face enrollment | Yes |
| 23 | User roles | Permissions | Yes |
| 24 | Create Schedule | Timetable | Yes |
| 25 | Venue location and radius | Venues | Yes |
| 26 | Holidays and breaks | System | Recommended |
| 27 | Location verified | Location check | Yes |
| 28 | Try Again location message | Location failure | Yes |
| 29 | Face enrollment camera | Enrollment | Yes |
| 30 | Face verification | Attendance | Yes |
| 31 | Teaching staff report and export | Reports | Yes |
| 32 | Attendance settings | System settings | Yes |

---

## 16. Documentation verification checklist

| Section | Verified against the system | Still needs a person to confirm |
| --- | --- | --- |
| 1. Introduction | App name, institution name, staff types, and disabled self-registration | Official public web address |
| 2. Requirements | Camera and location are required only when those settings are on | Official browser policy |
| 3. Access | Sign-in labels, Staff ID portal, Log out, forgot password, profile, appearance | Full public portal address; whether forgot password is on in production |
| 4. Roles | Lecturer, Administrator staff type, Director/Dean, Head of Department, permission-based office roles | The actual office role names in use |
| 5. Dashboards | Lecturer, staff, and administration dashboard content | — |
| 6. Modules | Menu names and who they are shown to | — |
| 7. Workflows | Check-in, check-out, location, face, approvals, reports, users, settings | — |
| 8. Reports | Report pages and Excel, CSV, PDF, and Print exports | Which roles currently have export permission |
| 9. Settings | Setting names and seeded defaults | The values saved in the live system |
| 10. Notifications | Triggers and on/off settings | Whether email delivery is working |
| 11. Troubleshooting | Messages and causes present in the system | — |
| 12. FAQ | Based on the same rules | — |
| 13. Security | Password, logout, camera, location, delete-account warning | — |
| 14. Support | Help Desk fields, categories, priorities, and statuses | Support email, phone, and hours |
| Screenshots | Placeholders only. Logo file exists in the project. | All screenshots still need to be captured |

---

*End of user guide.*
