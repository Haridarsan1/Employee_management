# Employee Management System

A comprehensive HR management solution built with React, TypeScript, Vite, and Supabase.

## 🚀 Features

- **Multi-tenant Architecture** - Organizations can manage their own employees
- **Role-based Access Control** - Owner, Admin, HR, Finance, Manager, Employee roles
- **Employee Management** - Add, edit, and manage employee records
- **Attendance Tracking** - Clock in/out with location tracking
- **Leave Management** - Request and approve leave
- **Payroll Management** - Salary calculations and payment tracking
- **Task Management** - Assign and track tasks
- **Announcements** - Company-wide communications
- **Responsive Design** - Works on desktop and mobile

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel
- **State Management**: React Context

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd employee-management-system
npm install
```

### 2. Environment Setup
Copy `.env` and update with your Supabase credentials:
```bash
cp .env.example .env
```

### 3. Database Setup
1. Create a new Supabase project
2. Run the `database-setup.sql` script in SQL Editor
3. Configure authentication settings

### 4. Development
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React contexts (Auth, Theme)
├── lib/               # Utilities and configurations
├── pages/             # Page components
└── types/             # TypeScript type definitions
```

## 🔐 Authentication

The app uses Supabase Auth with email confirmation. New users automatically become organization owners with admin privileges.

## 📊 Database Schema

- **organizations** - Multi-tenant organization data
- **organization_members** - User roles within organizations
- **user_profiles** - Extended user information
- **employees** - Employee records
- **attendance** - Time tracking
- **leave_requests** - Leave management
- **payroll** - Salary and payment data
- **tasks** - Task assignments
- **announcements** - Company communications

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Manual Deployment
```bash
npm run build
# Deploy the dist/ folder to your hosting provider
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues:
1. Check the `SETUP_GUIDE.md` for detailed instructions
2. Verify your environment variables
3. Check Supabase logs for database errors
4. Open an issue with detailed error messages