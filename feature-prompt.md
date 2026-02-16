# 🚀 Feature: Prayer Request & Testimony Submission Buttons

## 🎯 Objective

Add two buttons below the Play Controls section of the music player UI:

- 🙏 **Prayer Request** (Right side)
- 🌟 **Share Testimonies** (Left side)

Each button should open a popup modal with a submission form.

---

## 📍 UI Placement

| PLAY CONTROLS |
| (Play / Pause / Volume) |
| [Share Testimonies] [Prayer Request] |

### Layout Requirements

- Buttons must be horizontally aligned
- Equal width
- Responsive (stack vertically on small screens)
- Maintain existing app design system
- Smooth hover and press animation
- Must not interrupt audio playback

---

# 🙏 Prayer Request Feature

## Button Label
**Prayer Request**

## On Click
Open centered modal with blurred background overlay.

---

## 📦 Modal Structure

### Title
**Submit Your Prayer Request**

### Form Fields
- Full Name (required)
- Email Address (required, validated)
- Prayer Request (textarea, required, minimum 20 characters)

### Buttons
- Submit
- Cancel (closes modal)

---

## 🧠 Backend Requirements

### API Endpoint


POST /api/prayer-request


### Request Payload
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Please pray for my family..."
}

🔐 Validation Rules

All required fields must be validated

Email format validation

Sanitize inputs to prevent XSS

Rate limit submissions (e.g., 3 per hour per IP)

Max message length: 1000 characters

📧 Submission Handling Options
Option A – Email Only

Send submission to official station email via SMTP.

Option B – Database Storage (Recommended)

Create table:

prayer_requests
---------------
id
name
email
message
created_at

Option C – Email + Database

Store submission and send notification email.

✅ Success Response

After successful submission:

Display confirmation message:

"Your prayer request has been received. God bless you."

Auto-close modal after 3 seconds OR

Reset form for new submission

🌟 Share Testimonies Feature
Button Label

Share Testimonies

On Click

Open modal similar to Prayer Request.

📦 Modal Structure
Title

Share Your Testimony

Fields

Full Name (required)

Email Address (optional)

Testimony Message (required, minimum 30 characters)

Checkbox: "Allow us to share this publicly"

🧠 Backend Endpoint
POST /api/testimonies

Request Payload
{
  "name": "Jane",
  "email": "jane@example.com",
  "message": "God healed me...",
  "allowPublicShare": true
}

🗄 Database Table
testimonies
-----------
id
name
email
message
allow_public_share (boolean)
created_at

🎨 UI/UX Requirements

Use reusable modal component

Smooth fade-in animation

Close when clicking outside modal

Close with ESC key

Disable submit button while loading

Show loading spinner on submit

Accessible (ARIA labels included)

📱 Mobile Behavior

Buttons stack vertically

Modal becomes full-width

Scrollable textarea for long messages

Maintain good spacing and readability

🛡 Security & Protection

Input sanitization

Prevent SQL injection

Rate limiting enabled

Optional invisible reCAPTCHA

Server-side validation required

✅ Acceptance Criteria

Buttons render correctly below play controls

Modals open and close smoothly

Form validation works correctly

Data stored or emailed securely

Feature works on Android WebView and browsers

Audio playback remains uninterrupted

🔮 Future Enhancements

Admin dashboard to view submissions

Approve testimonies before publishing

Display approved testimonies inside app

Push notifications

Anonymous submission option