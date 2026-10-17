# SkillBridge — Next-Generation Peer-to-Peer Skill Exchange Platform

> **"Your Skills Are Your Currency."**  
> *Learn something new. Teach what you know. Grow together.*

SkillBridge is a modern, responsive, student-centric, peer-to-peer skill exchange platform where individuals and students learn new skills by teaching what they already know — with zero financial transactions.

---

## 🚀 Key Features

### 1. Liquid Glass Aesthetic (iOS-inspired Design System)
- Translucent frosted glass panels with dynamic backdrop blur (`backdrop-blur-xl`, `backdrop-blur-md`).
- Floating liquid glass navigation bar with active state pills and unread notification badge.
- Fluid ambient gradient background orbs that float smoothly.
- Electric violet (`#7657FF`), Cyan blue (`#39D5F6`), Soft lavender (`#B7A4FF`), and Deep navy (`#0B1020`) color palette.
- High-contrast **Dark Mode & Light Mode** with instant theme toggle.

### 2. Explainable Rule-Based Smart Matching
- Transparent mathematical scoring formula based on:
  - Partner ability to teach requested skill (+45 pts)
  - Mutual exchange potential: user ability to teach what partner wants (+35 pts)
  - Shared spoken languages (+10 pts)
  - Format preference compatibility: Online / In-person (+5 pts)
  - Schedule availability overlap (+5 pts)
- Displays actionable breakdown: *"96% Match — Mutual Exchange Potential! Can teach you UI/UX Design and wants your Python"*.

### 3. Complete Exchange Lifecycle
- **Proposal Workflow:** Propose exchange specifying skill offered, skill requested, preferred schedule, and personalized note.
- **Status Lifecycle:** `pending` ➔ `accepted` ➔ `completed` (or `declined` / `cancelled`).
- **Learning Workspace:**
  - Dedicated workspace for each accepted pair.
  - Interactive milestone checklist.
  - Shared collaborative session notes (saved persistently).
  - External resource links (GitHub repos, Figma files, docs).
  - 1-click video call launcher via encrypted Jitsi Meet rooms.
  - **Mutual Double-Sided Completion:** Both partners confirm session completion to earn +25 Credits, +300 XP, and unlock verified review submission!

### 4. Non-Monetary Skill Credit System
- Transparent internal token system rewarding verified peer teaching.
- Complete approved sessions to earn credits; spend credits for priority community spotlight.
- Full transaction ledger showing timestamped credits history.
- Non-convertible safeguards: credits hold zero cash value and cannot be bought or sold.

### 5. Integrated Chat & Conversations
- 1-to-1 conversation view with real-time message bubbles and timestamps.
- Unread notification badges and auto-read tracking.
- Instant access to exchange workspaces and private video rooms directly from chat.

### 6. Career Skill Gap Analyzer
- Select a target career track (*Full Stack Product Engineer*, *AI & Machine Learning Engineer*, *UI/UX Product Designer*, *Creative Media Technologist*).
- Benchmark current competencies against industry curricula to calculate completion %.
- Lists missing skills and displays **Community Mentors Ready to Teach This** with 1-click exchange proposals!

### 7. Interactive Compatibility Network Map
- HTML5 Canvas interactive graph visualizing student nodes and mutual exchange links.
- Interactive click inspection highlighting compatible connections in real time.

### 8. Community Learning Rooms & Study Groups
- Browse and join student cohorts (e.g. *Full-Stack & Systems*, *Liquid Glass & Design Systems*, *AI Researchers*, *Multilingual Polyglot Circle*).
- Member rosters, schedule announcements, and discussion counters.
- "Create Study Room" modal to launch new student circles.

### 9. Gamification, Trust & Safety
- **Badges:** *First Exchange*, *Knowledge Sharer*, *Curious Learner*, *Consistency Champion*, *Community Mentor*, *SkillBridge Pioneer*.
- **XP & Streaks:** Daily learning activity and streak tracking with milestone progress.
- **Trust & Safety:** Verified student badges, verified exchange-only reviews, user reporting, and blocking controls.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Lucide React, Canvas Confetti |
| **Backend** | Node.js, Express 4, JWT (`jsonwebtoken`), `bcryptjs`, CORS, Dotenv |
| **Database** | Persistent JSON-backed ACID database with atomic writes (`server/data/db.json`) |
| **Video Calls** | Encrypted peer video conferencing via Jitsi Meet rooms |

---

## 🧑‍💻 Pre-Configured Demo Accounts

Use the **"Demo Switch"** dropdown in the navigation bar to instantly switch personas:

| Account | Email | Password | Role / Primary Skill |
|---|---|---|---|
| **Alex Rivera** | `alex@skillbridge.edu` | `password123` | Full-Stack Dev (Python, Node, Docker) |
| **Sophia Chen** | `sophia@skillbridge.edu` | `password123` | Product Designer (UI/UX, Figma, Systems) |
| **Marcus Vance** | `marcus@skillbridge.edu` | `password123` | AI Researcher (ML, PyTorch, Data Science) |
| **Elena Rostova** | `elena@skillbridge.edu` | `password123` | Polyglot Coach (Spanish, French, Debate) |
| **Priya Sharma** | `priya@skillbridge.edu` | `password123` | Motion & Video (Premiere Pro, After Effects) |
| **Platform Admin** | `admin@skillbridge.edu` | `admin123` | Safety & Governance Director |

---

## 🏃 Local Setup and Running

### 1. Install Dependencies
```bash
# In server directory
cd server
npm install

# In client directory
cd ../client
npm install
```

### 2. Start Servers
```bash
# Terminal 1: Backend API (runs on port 5000)
cd server
npm run dev

# Terminal 2: Frontend App (runs on port 5173)
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.
